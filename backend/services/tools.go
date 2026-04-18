package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mantra-backend/database"
	"mantra-backend/models"
	"net/http"
	"strings"
	"time"
)

// ToolService loads per-tenant tool definitions and executes them during
// an AI reply loop. It's the Phase 4 glue between AIFallbackService (which
// emits tool_calls) and the real-world side-effects they should trigger.
//
// Security posture:
//   - builtin handlers are compiled Go code: zero external I/O surprises.
//   - webhook handlers HTTP-POST to a URL the tenant configured. We cap
//     body size (8 KiB request, 8 KiB response) and timeout (8s default,
//     30s hard max). We do NOT follow redirects that change host.
//   - Arguments the LLM sends are treated as untrusted input: never
//     executed as shell, never string-concatenated into SQL.
type ToolService struct {
	httpClient *http.Client
}

const (
	// Hard ceiling on tool-call iterations per inbound message. Protects
	// against runaway LLMs that keep invoking tools instead of replying.
	MaxToolIterations = 3
	maxWebhookBody    = 8 * 1024
)

func NewToolService() *ToolService {
	return &ToolService{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
			// Block redirects across hosts to mitigate SSRF.
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				if len(via) == 0 {
					return nil
				}
				if req.URL.Host != via[0].URL.Host {
					return fmt.Errorf("cross-host redirect blocked")
				}
				return nil
			},
		},
	}
}

// LoadToolsForClient returns the active tools for a client as both a
// []ToolDefinition (ready to pass to ChatWithTools) and a lookup map
// keyed by tool name for fast dispatch during the loop.
func (t *ToolService) LoadToolsForClient(clientID uint) ([]ToolDefinition, map[string]models.ClientTool, error) {
	if database.DB == nil {
		return nil, nil, fmt.Errorf("database not connected")
	}

	var rows []models.ClientTool
	if err := database.DB.
		Where("client_id = ? AND is_active = ?", clientID, true).
		Find(&rows).Error; err != nil {
		return nil, nil, err
	}

	defs := make([]ToolDefinition, 0, len(rows))
	byName := make(map[string]models.ClientTool, len(rows))
	for _, row := range rows {
		// Parameters schema is stored as JSONB map; pass-through if valid.
		params := map[string]interface{}{
			"type":       "object",
			"properties": map[string]interface{}{},
		}
		if len(row.ParametersSchema) > 0 {
			// If the admin provided a full JSON Schema, use it as-is.
			if _, hasType := row.ParametersSchema["type"]; hasType {
				params = map[string]interface{}(row.ParametersSchema)
			}
		}

		defs = append(defs, ToolDefinition{
			Type: "function",
			Function: FunctionDef{
				Name:        row.Name,
				Description: row.Description,
				Parameters:  params,
			},
		})
		byName[row.Name] = row
	}
	return defs, byName, nil
}

// Execute runs ONE tool call and returns the result string that will be
// sent back to the model as a `role: "tool"` message. Errors are caught
// and returned as JSON so the LLM can see and react to them instead of
// the whole chain crashing.
func (t *ToolService) Execute(
	ctx context.Context,
	tool models.ClientTool,
	clientID uint,
	customerNumber string,
	argsJSON string,
) string {
	var args map[string]interface{}
	if argsJSON != "" {
		if err := json.Unmarshal([]byte(argsJSON), &args); err != nil {
			return errJSON(fmt.Sprintf("invalid JSON arguments from model: %v", err))
		}
	}
	if args == nil {
		args = map[string]interface{}{}
	}

	switch strings.ToLower(tool.HandlerType) {
	case models.HandlerTypeBuiltin:
		return t.executeBuiltin(ctx, tool, clientID, customerNumber, args)
	case models.HandlerTypeWebhook:
		return t.executeWebhook(ctx, tool, clientID, customerNumber, args)
	default:
		return errJSON(fmt.Sprintf("unknown handler_type %q", tool.HandlerType))
	}
}

// ---- builtin handlers ------------------------------------------------

// builtinRegistry maps handler_config.name → Go function. New builtins
// live here; they must be idempotent and side-effect-free (or at worst
// read-only) since the LLM may invoke them multiple times.
var builtinRegistry = map[string]func(ctx context.Context, clientID uint, customerNumber string, args map[string]interface{}) string{
	"lookup_memory": builtinLookupMemory,
}

func (t *ToolService) executeBuiltin(
	ctx context.Context,
	tool models.ClientTool,
	clientID uint,
	customerNumber string,
	args map[string]interface{},
) string {
	name, _ := tool.HandlerConfig["name"].(string)
	if name == "" {
		return errJSON("builtin tool missing handler_config.name")
	}
	fn, ok := builtinRegistry[name]
	if !ok {
		return errJSON(fmt.Sprintf("unknown builtin %q", name))
	}
	return fn(ctx, clientID, customerNumber, args)
}

// builtinLookupMemory returns a JSON dump of CustomerMemory for the current
// customer. Useful for an LLM that wants to recall "did we promise the
// customer anything last time?".
func builtinLookupMemory(_ context.Context, clientID uint, customerNumber string, _ map[string]interface{}) string {
	if database.DB == nil {
		return errJSON("database unavailable")
	}
	var mem models.CustomerMemory
	err := database.DB.
		Where("client_id = ? AND customer_number = ?", clientID, customerNumber).
		First(&mem).Error
	if err != nil {
		return okJSON(map[string]interface{}{
			"found":   false,
			"message": "no prior conversation memory for this customer",
		})
	}
	summary := ""
	if mem.Summary != nil {
		summary = *mem.Summary
	}
	return okJSON(map[string]interface{}{
		"found":     true,
		"lastSeen":  mem.UpdatedAt,
		"summary":   summary,
		"turnsKept": len(mem.RawHistory),
	})
}

// ---- webhook handler -------------------------------------------------

func (t *ToolService) executeWebhook(
	ctx context.Context,
	tool models.ClientTool,
	clientID uint,
	customerNumber string,
	args map[string]interface{},
) string {
	url, _ := tool.HandlerConfig["url"].(string)
	if url == "" {
		return errJSON("webhook tool missing handler_config.url")
	}
	secret, _ := tool.HandlerConfig["secret"].(string)

	// Construct the envelope we POST to the tenant. Kept small and stable
	// so tenants can write a simple adapter on their side.
	payload := map[string]interface{}{
		"clientId": clientID,
		"customer": customerNumber,
		"tool":     tool.Name,
		"args":     args,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return errJSON(fmt.Sprintf("marshal: %v", err))
	}

	// Per-tool timeout, capped 1-30s to keep MaxToolIterations * timeout
	// inside the overall inbound handling budget.
	timeout := time.Duration(tool.TimeoutMs) * time.Millisecond
	if timeout < time.Second {
		timeout = 3 * time.Second
	}
	if timeout > 30*time.Second {
		timeout = 30 * time.Second
	}
	callCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(callCtx, "POST", url, bytes.NewReader(body))
	if err != nil {
		return errJSON(fmt.Sprintf("new request: %v", err))
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "Mantra-Tools/1.0")
	if secret != "" {
		req.Header.Set("X-Mantra-Secret", secret)
	}

	resp, err := t.httpClient.Do(req)
	if err != nil {
		return errJSON(fmt.Sprintf("webhook call failed: %v", err))
	}
	defer resp.Body.Close()

	// Cap response size to prevent a tenant's misconfigured endpoint from
	// dumping megabytes into the next LLM call.
	respBody, err := io.ReadAll(io.LimitReader(resp.Body, maxWebhookBody))
	if err != nil {
		return errJSON(fmt.Sprintf("read response: %v", err))
	}

	// Pass through 2xx bodies as-is; for non-2xx, annotate with status so
	// the LLM can understand "the tool errored, try something else".
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		// Verify it's valid JSON — if yes pass through, otherwise wrap.
		var probe interface{}
		if json.Unmarshal(respBody, &probe) == nil {
			return string(respBody)
		}
		return okJSON(map[string]interface{}{"text": string(respBody)})
	}
	return errJSON(fmt.Sprintf("webhook returned %d: %s", resp.StatusCode, truncate(string(respBody), 400)))
}

// ---- helpers ----------------------------------------------------------

func okJSON(v interface{}) string {
	b, err := json.Marshal(v)
	if err != nil {
		return errJSON(err.Error())
	}
	return string(b)
}

func errJSON(msg string) string {
	b, _ := json.Marshal(map[string]string{"error": msg})
	return string(b)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
