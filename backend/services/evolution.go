package services

import (
        "bytes"
        "encoding/json"
        "fmt"
        "io"
        "mantra-backend/config"
        "net/http"
        "strings"
        "time"
)

type EvolutionService struct {
        httpClient *http.Client
}

type CreateInstanceRequest struct {
        InstanceName string `json:"instanceName"`
        WebhookURL   string `json:"webhookUrl,omitempty"`
        WebhookByEvents bool `json:"webhookByEvents,omitempty"`
}

type EvolutionInstance struct {
        InstanceName string `json:"instanceName"`
        Status       string `json:"instance_status"`
        APIKey       string `json:"hash"`
}

type EvolutionQRCode struct {
        QRCode string `json:"qrcode"`
}

func NewEvolutionService() *EvolutionService {
        return &EvolutionService{
                httpClient: &http.Client{
                        Timeout: 30 * time.Second,
                },
        }
}

func (s *EvolutionService) getBaseURL() string {
        if config.C != nil && config.C.EvolutionURL != "" {
                return config.C.EvolutionURL
        }
        return "http://localhost:8080"
}

func (s *EvolutionService) getAPIKey() string {
        if config.C != nil {
                return config.C.EvolutionKey
        }
        return ""
}

func (s *EvolutionService) doRequest(method, path string, body interface{}) ([]byte, int, error) {
        var reqBody io.Reader
        if body != nil {
                b, err := json.Marshal(body)
                if err != nil {
                        return nil, 0, err
                }
                reqBody = bytes.NewBuffer(b)
        }

        req, err := http.NewRequest(method, s.getBaseURL()+path, reqBody)
        if err != nil {
                return nil, 0, err
        }
        req.Header.Set("Content-Type", "application/json")
        req.Header.Set("apikey", s.getAPIKey())

        resp, err := s.httpClient.Do(req)
        if err != nil {
                return nil, 0, err
        }
        defer resp.Body.Close()

        respBody, _ := io.ReadAll(resp.Body)
        return respBody, resp.StatusCode, nil
}

func (s *EvolutionService) CreateInstance(instanceName, webhookURL string) (*EvolutionInstance, error) {
        payload := CreateInstanceRequest{
                InstanceName:    instanceName,
                WebhookURL:      webhookURL,
                WebhookByEvents: false,
        }

        respBody, status, err := s.doRequest("POST", "/instance/create", payload)
        if err != nil {
                return nil, fmt.Errorf("evolution API request failed: %v", err)
        }
        if status != http.StatusCreated && status != http.StatusOK {
                return nil, fmt.Errorf("evolution API returned %d: %s", status, string(respBody))
        }

        var result struct {
                Instance EvolutionInstance `json:"instance"`
                Hash     struct {
                        APIKey string `json:"apikey"`
                } `json:"hash"`
        }
        if err := json.Unmarshal(respBody, &result); err != nil {
                return nil, fmt.Errorf("failed to decode evolution response: %v", err)
        }

        result.Instance.APIKey = result.Hash.APIKey
        return &result.Instance, nil
}

// SetWebhook configures which backend URL Evolution should call for events on
// an instance. Evolution will POST each message event to `url` with the full
// payload. Events list keeps the wire small by only subscribing to what we use.
//
// When WEBHOOK_SECRET is configured, Evolution v2+ will forward it as a custom
// `X-Webhook-Secret` header — older versions silently ignore the `headers`
// field, in which case the operator must configure the header at the reverse
// proxy layer (or disable webhook auth in dev).
func (s *EvolutionService) SetWebhook(instanceName, url string) error {
        payload := map[string]interface{}{
                "url":             url,
                "enabled":         true,
                "webhookByEvents": false,
                "webhookBase64":   false,
                "events": []string{
                        "MESSAGES_UPSERT",
                        "CONNECTION_UPDATE",
                },
        }
        if config.C != nil && config.C.WebhookSecret != "" {
                payload["headers"] = map[string]string{
                        "X-Webhook-Secret": config.C.WebhookSecret,
                }
        }
        respBody, status, err := s.doRequest("POST", "/webhook/set/"+instanceName, payload)
        if err != nil {
                return fmt.Errorf("webhook set request failed: %v", err)
        }
        if status != http.StatusOK && status != http.StatusCreated {
                // Strip the response body to a single line for easier log grep
                body := strings.ReplaceAll(string(respBody), "\n", " ")
                return fmt.Errorf("webhook set returned %d: %s", status, body)
        }
        return nil
}

// SendText dispatches a plain-text WhatsApp message via Evolution.
// `to` should be a bare E.164 number (e.g. "6281234567890") — Evolution will
// normalize it to the proper JID.
func (s *EvolutionService) SendText(instanceName, to, text string) error {
        payload := map[string]interface{}{
                "number":  to,
                "options": map[string]interface{}{"delay": 0, "presence": "composing"},
                "textMessage": map[string]interface{}{
                        "text": text,
                },
        }
        respBody, status, err := s.doRequest("POST", "/message/sendText/"+instanceName, payload)
        if err != nil {
                return fmt.Errorf("send text request failed: %v", err)
        }
        if status != http.StatusOK && status != http.StatusCreated {
                return fmt.Errorf("send text returned %d: %s", status, string(respBody))
        }
        return nil
}

func (s *EvolutionService) DeleteInstance(instanceName string) error {
        _, status, err := s.doRequest("DELETE", "/instance/delete/"+instanceName, nil)
        if err != nil {
                return err
        }
        if status != http.StatusOK && status != http.StatusNoContent {
                return fmt.Errorf("evolution API returned %d while deleting", status)
        }
        return nil
}

func (s *EvolutionService) DisconnectInstance(instanceName string) error {
        _, status, err := s.doRequest("DELETE", "/instance/logout/"+instanceName, nil)
        if err != nil {
                return err
        }
        if status != http.StatusOK && status != http.StatusNoContent {
                return fmt.Errorf("evolution API returned %d while disconnecting", status)
        }
        return nil
}

func (s *EvolutionService) GetInstanceStatus(instanceName string) (string, error) {
        respBody, status, err := s.doRequest("GET", "/instance/connectionState/"+instanceName, nil)
        if err != nil {
                return "", err
        }
        if status != http.StatusOK {
                return "ERROR", fmt.Errorf("evolution API returned %d", status)
        }

        var result struct {
                Instance struct {
                        State string `json:"state"`
                } `json:"instance"`
        }
        if err := json.Unmarshal(respBody, &result); err != nil {
                return "ERROR", nil
        }

        switch result.Instance.State {
        case "open":
                return "CONNECTED", nil
        case "connecting":
                return "CONNECTING", nil
        case "close":
                return "DISCONNECTED", nil
        default:
                return "DISCONNECTED", nil
        }
}

func (s *EvolutionService) GetQRCode(instanceName string) (string, error) {
        respBody, status, err := s.doRequest("GET", "/instance/connect/"+instanceName, nil)
        if err != nil {
                return "", err
        }
        if status != http.StatusOK {
                return "", fmt.Errorf("evolution API returned %d while getting QR", status)
        }

        var result struct {
                Base64 string `json:"base64"`
                Code   string `json:"code"`
        }
        if err := json.Unmarshal(respBody, &result); err != nil {
                return "", fmt.Errorf("failed to decode QR response: %v", err)
        }

        if result.Base64 != "" {
                return result.Base64, nil
        }
        return result.Code, nil
}
