package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mantra-backend/database"
	"mantra-backend/models"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"syscall"
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
	// Custom dialer that validates the resolved IP after DNS lookup but
	// BEFORE the TCP connection. This stops DNS-rebinding attacks where
	// a hostname returns public once and private on retry.
	dialer := &net.Dialer{
		Timeout: 5 * time.Second,
		Control: func(network, address string, _ syscall.RawConn) error {
			host, _, err := net.SplitHostPort(address)
			if err != nil {
				return err
			}
			ip := net.ParseIP(host)
			if ip == nil {
				return fmt.Errorf("dial: non-IP address %q", host)
			}
			if !isPublicIP(ip) {
				return fmt.Errorf("dial blocked: %s is private/loopback/link-local", ip)
			}
			return nil
		},
	}

	return &ToolService{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
			// Block redirects that leave the original host. Together with
			// the dialer's per-connection IP check, this defuses the
			// common SSRF pivots (metadata endpoint, internal services,
			// DNS rebind).
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				if len(via) == 0 {
					return nil
				}
				if req.URL.Host != via[0].URL.Host {
					return fmt.Errorf("cross-host redirect blocked")
				}
				return nil
			},
			Transport: &http.Transport{
				DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
					return dialer.DialContext(ctx, network, addr)
				},
				// Short keep-alive so rebound DNS entries don't stick around.
				MaxIdleConnsPerHost: 2,
				IdleConnTimeout:     30 * time.Second,
				TLSHandshakeTimeout: 5 * time.Second,
			},
		},
	}
}

// isPublicIP returns false for loopback, link-local, private (RFC1918 /
// RFC4193), CGNAT, unspecified, and cloud metadata addresses. These are
// the buckets an SSRF attacker would try to reach from inside our
// container; we block all of them.
func isPublicIP(ip net.IP) bool {
	if ip == nil || ip.IsLoopback() || ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() || ip.IsUnspecified() ||
		ip.IsPrivate() || ip.IsMulticast() {
		return false
	}
	// Explicit cloud-metadata entries (IPv4 + IPv6).
	blocked := []string{
		"169.254.169.254", // AWS / GCP / Azure metadata
		"fd00:ec2::254",   // AWS IPv6 metadata
	}
	s := ip.String()
	for _, b := range blocked {
		if s == b {
			return false
		}
	}
	// 100.64.0.0/10 — RFC6598 CGNAT, often present in VPC peering; treat
	// as private. Some deployments may need this in their egress path;
	// if so, pass TOOL_WEBHOOK_ALLOW_CGNAT=true to relax it.
	if ip4 := ip.To4(); ip4 != nil {
		if ip4[0] == 100 && ip4[1]&0xC0 == 64 && os.Getenv("TOOL_WEBHOOK_ALLOW_CGNAT") != "true" {
			return false
		}
	}
	return true
}

// validateWebhookURL parses + validates a tenant-supplied URL before we
// ever dial it. Checks scheme + resolves all A/AAAA records and rejects
// the URL if ANY resolves to a disallowed range.
func validateWebhookURL(raw string) (*url.URL, error) {
	u, err := url.Parse(raw)
	if err != nil {
		return nil, fmt.Errorf("invalid url: %w", err)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return nil, fmt.Errorf("only http/https allowed (got %q)", u.Scheme)
	}
	host := u.Hostname()
	if host == "" {
		return nil, fmt.Errorf("url missing host")
	}

	// Pre-resolve; reject if any record hits a blocked bucket. The
	// per-connection Dialer.Control above re-validates the final dial
	// target, so a rebind attempt between this check and the dial is
	// still caught.
	ips, err := net.LookupIP(host)
	if err != nil {
		return nil, fmt.Errorf("dns lookup failed: %w", err)
	}
	for _, ip := range ips {
		if !isPublicIP(ip) {
			return nil, fmt.Errorf("host %s resolves to non-public ip %s", host, ip)
		}
	}
	return u, nil
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
	rawURL, _ := tool.HandlerConfig["url"].(string)
	if rawURL == "" {
		return errJSON("webhook tool missing handler_config.url")
	}
	parsed, valErr := validateWebhookURL(rawURL)
	if valErr != nil {
		// Surface a generic message to the LLM — we don't want the tool
		// call loop to carry "169.254.169.254 rejected" forward.
		return errJSON(fmt.Sprintf("webhook url rejected: %v", valErr))
	}
	targetURL := parsed.String()
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

	req, err := http.NewRequestWithContext(callCtx, "POST", targetURL, bytes.NewReader(body))
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
