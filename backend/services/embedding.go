package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mantra-backend/database"
	"mantra-backend/models"
	"net/http"
	"strings"
	"time"
)

// EmbeddingService turns arbitrary text into a fixed-length float32 vector
// using an OpenAI-compatible /v1/embeddings endpoint.
//
// It uses the SAME ai_providers table as AIFallbackService. The provider
// with the lowest priority (and is_active=true) whose model matches or is
// just `openai` / `openrouter` is tried first; others fall through on error.
//
// Default model is `text-embedding-3-small` (1536 dim, cheap, widely
// supported). Override via the Model parameter.
//
// The pgvector column in client_knowledge_chunks expects 1536 dims. If you
// switch to a different embedding model with a different dimension, you
// MUST also change the column type in init.sql and re-embed existing rows.
type EmbeddingService struct {
	httpClient *http.Client
}

const (
	DefaultEmbeddingModel = "text-embedding-3-small"
	EmbeddingDim          = 1536
)

type embedRequest struct {
	Model string   `json:"model"`
	Input []string `json:"input"`
}

type embedResponseItem struct {
	Embedding []float32 `json:"embedding"`
	Index     int       `json:"index"`
}

type embedResponse struct {
	Data  []embedResponseItem `json:"data"`
	Model string              `json:"model"`
}

func NewEmbeddingService() *EmbeddingService {
	return &EmbeddingService{
		httpClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// Embed computes a vector for each input string. The returned slice is
// aligned to inputs (one vector per input). The provider used is returned
// for audit/logging.
//
// On first call failure, the service falls through to the next active
// provider in priority order (same pattern as AIFallbackService.Chat).
//
// `clientID == nil` means "use global providers". Pass a client ID to
// include their tenant-specific provider list.
func (e *EmbeddingService) Embed(clientID *uint, model string, inputs []string) ([][]float32, string, error) {
	if len(inputs) == 0 {
		return nil, "", fmt.Errorf("no inputs to embed")
	}
	if model == "" {
		model = DefaultEmbeddingModel
	}

	providers, err := e.providersForEmbedding(clientID)
	if err != nil {
		return nil, "", err
	}
	if len(providers) == 0 {
		return nil, "", fmt.Errorf("no active AI provider configured for embeddings")
	}

	var lastErr error
	for _, p := range providers {
		vectors, err := e.callProvider(p, model, inputs)
		if err != nil {
			lastErr = err
			continue
		}
		return vectors, p.ProviderName, nil
	}
	return nil, "", fmt.Errorf("all embedding providers failed: %w", lastErr)
}

// EmbedOne is a convenience wrapper for single-string embedding.
func (e *EmbeddingService) EmbedOne(clientID *uint, model, input string) ([]float32, string, error) {
	vectors, provider, err := e.Embed(clientID, model, []string{input})
	if err != nil {
		return nil, "", err
	}
	if len(vectors) == 0 {
		return nil, "", fmt.Errorf("no vector returned")
	}
	return vectors[0], provider, nil
}

// providersForEmbedding returns candidates sorted by priority. Any OpenAI-
// compatible provider works (OpenAI, OpenRouter, Together, DeepInfra,
// Azure OpenAI). Groq does NOT currently host embedding models, so we
// skip "groq" provider names explicitly.
func (e *EmbeddingService) providersForEmbedding(clientID *uint) ([]models.AIProvider, error) {
	ai := NewAIFallbackService()
	providers, err := ai.GetProvidersByPriority(clientID)
	if err != nil {
		return nil, err
	}
	filtered := providers[:0]
	for _, p := range providers {
		name := strings.ToLower(p.ProviderName)
		// Groq doesn't offer embeddings today; skip to avoid guaranteed 404.
		if strings.Contains(name, "groq") {
			continue
		}
		filtered = append(filtered, p)
	}
	return filtered, nil
}

func (e *EmbeddingService) callProvider(p models.AIProvider, model string, inputs []string) ([][]float32, error) {
	baseURL := "https://api.openai.com/v1"
	if p.BaseURL != nil && *p.BaseURL != "" {
		baseURL = strings.TrimRight(*p.BaseURL, "/")
	}

	body, err := json.Marshal(embedRequest{Model: model, Input: inputs})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", baseURL+"/embeddings", bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.APIKey)

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("embed request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		if database.DB != nil {
			errMsg := fmt.Sprintf("embed %d: %s", resp.StatusCode, string(respBody))
			database.DB.Model(&p).Update("last_error", errMsg)
		}
		return nil, fmt.Errorf("provider %s returned %d", p.ProviderName, resp.StatusCode)
	}

	var parsed embedResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return nil, fmt.Errorf("decode embed response: %w", err)
	}
	if len(parsed.Data) != len(inputs) {
		return nil, fmt.Errorf("provider returned %d vectors for %d inputs", len(parsed.Data), len(inputs))
	}

	// Sort by Index to guarantee alignment even if provider reorders
	out := make([][]float32, len(inputs))
	for _, item := range parsed.Data {
		if item.Index < 0 || item.Index >= len(out) {
			continue
		}
		if len(item.Embedding) != EmbeddingDim {
			return nil, fmt.Errorf("unexpected embedding dim %d (want %d). Model: %s", len(item.Embedding), EmbeddingDim, model)
		}
		out[item.Index] = item.Embedding
	}
	return out, nil
}

// VectorLiteral converts a []float32 to the Postgres `vector` input format
// ("[0.1,0.2,0.3]"). Used by handlers that insert chunks — GORM doesn't
// understand pgvector, so we bind the literal via raw SQL.
func VectorLiteral(v []float32) string {
	var b strings.Builder
	b.WriteByte('[')
	for i, f := range v {
		if i > 0 {
			b.WriteByte(',')
		}
		fmt.Fprintf(&b, "%g", f)
	}
	b.WriteByte(']')
	return b.String()
}
