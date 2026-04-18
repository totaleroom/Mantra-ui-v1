package services

import (
        "bytes"
        "encoding/json"
        "fmt"
        "io"
        "mantra-backend/database"
        "mantra-backend/models"
        "net/http"
        "sort"
        "strings"
        "time"
)

// ChatMessage is one turn in a conversation. The tool-calling fields are
// all optional and only set when the message is either an assistant
// tool-call request or a tool response being fed back to the model.
type ChatMessage struct {
        Role       string     `json:"role"`
        Content    string     `json:"content"`
        Name       string     `json:"name,omitempty"`
        ToolCallID string     `json:"tool_call_id,omitempty"`
        ToolCalls  []ToolCall `json:"tool_calls,omitempty"`
}

// ToolCall mirrors the OpenAI function-calling response shape.
type ToolCall struct {
        ID       string           `json:"id"`
        Type     string           `json:"type"` // always "function" today
        Function ToolCallFunction `json:"function"`
}

type ToolCallFunction struct {
        Name      string `json:"name"`
        Arguments string `json:"arguments"` // JSON-encoded args, parse with json.Unmarshal
}

// ToolDefinition is the OpenAI-compatible function-calling tool entry.
type ToolDefinition struct {
        Type     string       `json:"type"` // always "function"
        Function FunctionDef  `json:"function"`
}

type FunctionDef struct {
        Name        string                 `json:"name"`
        Description string                 `json:"description"`
        Parameters  map[string]interface{} `json:"parameters"`
}

type ChatRequest struct {
        Model       string           `json:"model"`
        Messages    []ChatMessage    `json:"messages"`
        Temperature float64          `json:"temperature"`
        MaxTokens   int              `json:"max_tokens,omitempty"`
        Tools       []ToolDefinition `json:"tools,omitempty"`
        ToolChoice  string           `json:"tool_choice,omitempty"` // "auto" | "none" | "required"
}

type ChatChoice struct {
        Message      ChatMessage `json:"message"`
        FinishReason string      `json:"finish_reason"`
}

type ChatResponse struct {
        ID      string       `json:"id"`
        Choices []ChatChoice `json:"choices"`
        Model   string       `json:"model"`
}

type AIFallbackService struct {
        httpClient *http.Client
}

func NewAIFallbackService() *AIFallbackService {
        return &AIFallbackService{
                httpClient: &http.Client{Timeout: 30 * time.Second},
        }
}

func (s *AIFallbackService) GetProvidersByPriority(clientID *uint) ([]models.AIProvider, error) {
        if database.DB == nil {
                return nil, fmt.Errorf("database not connected")
        }

        var providers []models.AIProvider
        query := database.DB.Where("is_active = ?", true)
        if clientID != nil {
                query = query.Where("client_id = ? OR client_id IS NULL", *clientID)
        } else {
                query = query.Where("client_id IS NULL")
        }
        if err := query.Find(&providers).Error; err != nil {
                return nil, err
        }

        sort.Slice(providers, func(i, j int) bool {
                return providers[i].Priority < providers[j].Priority
        })
        return providers, nil
}

// Chat is the no-tools entry point — preserved for callers that don't
// need function calling. Internally calls ChatWithTools with tools=nil.
func (s *AIFallbackService) Chat(clientID *uint, modelID string, messages []ChatMessage, temperature float64) (*ChatResponse, string, error) {
        return s.ChatWithTools(clientID, modelID, messages, temperature, nil)
}

// ChatWithTools runs the provider fallback chain with optional tools. When
// tools is nil or empty the request is a plain chat completion; the
// returned *ChatResponse contains either a normal assistant message or an
// assistant message with tool_calls populated (inspect
// resp.Choices[0].Message.ToolCalls to decide).
func (s *AIFallbackService) ChatWithTools(clientID *uint, modelID string, messages []ChatMessage, temperature float64, tools []ToolDefinition) (*ChatResponse, string, error) {
        providers, err := s.GetProvidersByPriority(clientID)
        if err != nil {
                return nil, "", err
        }
        if len(providers) == 0 {
                return nil, "", fmt.Errorf("no active AI providers configured")
        }

        var lastErr error
        for _, p := range providers {
                resp, err := s.callProvider(p, modelID, messages, temperature, tools)
                if err != nil {
                        lastErr = err
                        errMsg := err.Error()
                        if database.DB != nil {
                                database.DB.Model(&p).Update("last_error", errMsg)
                        }
                        continue
                }
                if database.DB != nil {
                        database.DB.Model(&p).Update("last_error", nil)
                }
                return resp, p.ProviderName, nil
        }

        return nil, "", fmt.Errorf("all providers failed. Last error: %v", lastErr)
}

func (s *AIFallbackService) callProvider(p models.AIProvider, modelID string, messages []ChatMessage, temperature float64, tools []ToolDefinition) (*ChatResponse, error) {
        baseURL := "https://api.openai.com/v1"
        if p.BaseURL != nil && *p.BaseURL != "" {
                baseURL = strings.TrimRight(*p.BaseURL, "/")
        }

        payload := ChatRequest{
                Model:       modelID,
                Messages:    messages,
                Temperature: temperature,
        }
        if len(tools) > 0 {
                payload.Tools = tools
                payload.ToolChoice = "auto"
        }

        body, err := json.Marshal(payload)
        if err != nil {
                return nil, err
        }

        req, err := http.NewRequest("POST", baseURL+"/chat/completions", bytes.NewBuffer(body))
        if err != nil {
                return nil, err
        }

        req.Header.Set("Content-Type", "application/json")
        req.Header.Set("Authorization", "Bearer "+p.APIKey)

        start := time.Now()
        resp, err := s.httpClient.Do(req)
        _ = time.Since(start)
        if err != nil {
                return nil, fmt.Errorf("request failed: %v", err)
        }
        defer resp.Body.Close()

        respBody, _ := io.ReadAll(resp.Body)
        if resp.StatusCode != http.StatusOK {
                return nil, fmt.Errorf("provider returned %d: %s", resp.StatusCode, string(respBody))
        }

        var chatResp ChatResponse
        if err := json.Unmarshal(respBody, &chatResp); err != nil {
                return nil, fmt.Errorf("failed to decode response: %v", err)
        }
        return &chatResp, nil
}

func (s *AIFallbackService) TestProvider(providerID uint) (int, error) {
        if database.DB == nil {
                return 0, fmt.Errorf("database not connected")
        }

        var p models.AIProvider
        if err := database.DB.First(&p, providerID).Error; err != nil {
                return 0, err
        }

        messages := []ChatMessage{
                {Role: "user", Content: "Say hello in one word."},
        }

        start := time.Now()
        _, err := s.callProvider(p, "gpt-3.5-turbo", messages, 0.1, nil)
        latency := int(time.Since(start).Milliseconds())

        if err != nil {
                return latency, err
        }
        return latency, nil
}

func (s *AIFallbackService) FetchModels(p models.AIProvider) ([]models.AIModel, error) {
        baseURL := "https://api.openai.com/v1"
        if p.BaseURL != nil && *p.BaseURL != "" {
                baseURL = strings.TrimRight(*p.BaseURL, "/")
        }

        req, err := http.NewRequest("GET", baseURL+"/models", nil)
        if err != nil {
                return nil, err
        }
        req.Header.Set("Authorization", "Bearer "+p.APIKey)

        resp, err := s.httpClient.Do(req)
        if err != nil {
                return nil, err
        }
        defer resp.Body.Close()

        if resp.StatusCode != http.StatusOK {
                return nil, fmt.Errorf("provider returned status %d", resp.StatusCode)
        }

        var result struct {
                Data []struct {
                        ID string `json:"id"`
                } `json:"data"`
        }
        if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
                return nil, err
        }

        var modelList []models.AIModel
        for _, m := range result.Data {
                modelList = append(modelList, models.AIModel{
                        ID:       m.ID,
                        Name:     m.ID,
                        Provider: p.ProviderName,
                })
        }
        return modelList, nil
}
