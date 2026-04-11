// backend-boilerplate-hint.go
// Go Fiber Backend Structs - MUST match frontend hooks exactly
// Generated from schema.ts and frontend API hooks

package models

import (
	"time"
)

// ===========================================
// ENUMS
// ===========================================

type UserRole string

const (
	UserRoleSuperAdmin  UserRole = "SUPER_ADMIN"
	UserRoleClientAdmin UserRole = "CLIENT_ADMIN"
	UserRoleStaff       UserRole = "STAFF"
)

type InstanceStatus string

const (
	InstanceStatusConnected    InstanceStatus = "CONNECTED"
	InstanceStatusConnecting   InstanceStatus = "CONNECTING"
	InstanceStatusDisconnected InstanceStatus = "DISCONNECTED"
	InstanceStatusError        InstanceStatus = "ERROR"
)

type MessageDirection string

const (
	MessageDirectionInbound  MessageDirection = "inbound"
	MessageDirectionOutbound MessageDirection = "outbound"
)

type ServiceStatus string

const (
	ServiceStatusHealthy   ServiceStatus = "healthy"
	ServiceStatusDegraded  ServiceStatus = "degraded"
	ServiceStatusUnhealthy ServiceStatus = "unhealthy"
)

// ===========================================
// DATABASE MODELS (match schema.ts)
// ===========================================

// User - maps to users table
type User struct {
	ID           int64     `json:"id" db:"id"`
	Email        string    `json:"email" db:"email"`
	PasswordHash string    `json:"-" db:"password_hash"` // Never expose in JSON
	Role         UserRole  `json:"role" db:"role"`
	CreatedAt    time.Time `json:"createdAt" db:"created_at"`
}

// Client - maps to clients table (tenants)
type Client struct {
	ID           int64     `json:"id" db:"id"`
	Name         string    `json:"name" db:"name"`
	TokenBalance int       `json:"tokenBalance" db:"token_balance"`
	TokenLimit   int       `json:"tokenLimit" db:"token_limit"`
	IsActive     bool      `json:"isActive" db:"is_active"`
	CreatedAt    time.Time `json:"createdAt" db:"created_at"`
}

// AIProvider - maps to ai_providers table
type AIProvider struct {
	ID           int64      `json:"id" db:"id"`
	ClientID     *int64     `json:"clientId" db:"client_id"` // null = global provider
	ProviderName string     `json:"providerName" db:"provider_name"`
	APIKey       string     `json:"apiKey" db:"api_key"` // Consider masking in responses
	BaseURL      *string    `json:"baseUrl" db:"base_url"`
	Priority     int        `json:"priority" db:"priority"`
	IsActive     bool       `json:"isActive" db:"is_active"`
	LastError    *string    `json:"lastError" db:"last_error"`
	UpdatedAt    time.Time  `json:"updatedAt" db:"updated_at"`
}

// ClientAIConfig - maps to client_ai_configs table
type ClientAIConfig struct {
	ID              int64   `json:"id" db:"id"`
	ClientID        int64   `json:"clientId" db:"client_id"`
	ModelID         string  `json:"modelId" db:"model_id"`
	SystemPrompt    string  `json:"systemPrompt" db:"system_prompt"`
	VectorNamespace *string `json:"vectorNamespace" db:"vector_namespace"`
	Temperature     float64 `json:"temperature" db:"temperature"`
	MemoryTTLDays   int     `json:"memoryTtlDays" db:"memory_ttl_days"`
}

// WhatsAppInstance - maps to whatsapp_instances table
type WhatsAppInstance struct {
	ID             int64          `json:"id" db:"id"`
	ClientID       int64          `json:"clientId" db:"client_id"`
	InstanceName   string         `json:"instanceName" db:"instance_name"`
	InstanceAPIKey *string        `json:"instanceApiKey" db:"instance_api_key"`
	WebhookURL     *string        `json:"webhookUrl" db:"webhook_url"`
	Status         InstanceStatus `json:"status" db:"status"`
	UpdatedAt      time.Time      `json:"updatedAt" db:"updated_at"`
}

// CustomerMemory - maps to customer_memories table
type CustomerMemory struct {
	ID             int64                    `json:"id" db:"id"`
	ClientID       int64                    `json:"clientId" db:"client_id"`
	CustomerNumber string                   `json:"customerNumber" db:"customer_number"`
	Summary        *string                  `json:"summary" db:"summary"`
	RawHistory     []map[string]interface{} `json:"rawHistory" db:"raw_history"` // JSONB
	ExpiresAt      time.Time                `json:"expiresAt" db:"expires_at"`
	UpdatedAt      time.Time                `json:"updatedAt" db:"updated_at"`
}

// SystemDiagnosis - maps to system_diagnosis table
type SystemDiagnosis struct {
	ID          int64     `json:"id" db:"id"`
	ServiceName string    `json:"serviceName" db:"service_name"`
	Status      string    `json:"status" db:"status"`
	Latency     int       `json:"latency" db:"latency"` // milliseconds
	LastCheck   time.Time `json:"lastCheck" db:"last_check"`
}

// ===========================================
// API REQUEST/RESPONSE DTOs
// ===========================================

// --- AI Provider DTOs ---

// CreateAIProviderRequest - POST /api/ai-providers
type CreateAIProviderRequest struct {
	ProviderName string  `json:"providerName" validate:"required,min=1"`
	APIKey       string  `json:"apiKey" validate:"required,min=1"`
	BaseURL      *string `json:"baseUrl" validate:"omitempty,url"`
	Priority     int     `json:"priority" validate:"min=1,max=10"`
	IsActive     bool    `json:"isActive"`
	ClientID     *int64  `json:"clientId"`
}

// UpdateAIProviderRequest - PATCH /api/ai-providers/:id
type UpdateAIProviderRequest struct {
	ProviderName *string `json:"providerName,omitempty"`
	APIKey       *string `json:"apiKey,omitempty"`
	BaseURL      *string `json:"baseUrl,omitempty"`
	Priority     *int    `json:"priority,omitempty" validate:"omitempty,min=1,max=10"`
	IsActive     *bool   `json:"isActive,omitempty"`
}

// UpdatePrioritiesRequest - PUT /api/ai-providers/priorities
type UpdatePrioritiesRequest struct {
	Priorities []PriorityUpdate `json:"priorities" validate:"required,dive"`
}

type PriorityUpdate struct {
	ID       int64 `json:"id" validate:"required"`
	Priority int   `json:"priority" validate:"required,min=1,max=10"`
}

// TestProviderResponse - POST /api/ai-providers/:id/test
type TestProviderResponse struct {
	Success bool    `json:"success"`
	Latency int     `json:"latency"` // milliseconds
	Error   *string `json:"error,omitempty"`
}

// AIModel - model info fetched from providers
type AIModel struct {
	ID            string       `json:"id"`
	Name          string       `json:"name"`
	Provider      string       `json:"provider"`
	ContextLength int          `json:"contextLength"`
	Pricing       ModelPricing `json:"pricing"`
}

type ModelPricing struct {
	Input  float64 `json:"input"`  // per 1K tokens
	Output float64 `json:"output"` // per 1K tokens
}

// --- WhatsApp Instance DTOs ---

// CreateWhatsAppInstanceRequest - POST /api/whatsapp/instances
type CreateWhatsAppInstanceRequest struct {
	InstanceName string  `json:"instanceName" validate:"required,min=3,max=50,lowercase,alphanumdash"`
	ClientID     int64   `json:"clientId" validate:"required,gt=0"`
	WebhookURL   *string `json:"webhookUrl" validate:"omitempty,url"`
}

// InstanceStatusResponse - GET /api/whatsapp/instances/:name/status
type InstanceStatusResponse struct {
	Status InstanceStatus `json:"status"`
}

// --- Inbox DTOs ---

// InboxMessage - message in the inbox feed
type InboxMessage struct {
	ID               string           `json:"id"`
	ClientID         int64            `json:"clientId"`
	ClientName       string           `json:"clientName"` // Joined from clients table
	CustomerNumber   string           `json:"customerNumber"`
	Message          string           `json:"message"`
	Direction        MessageDirection `json:"direction"`
	Timestamp        time.Time        `json:"timestamp"`
	AIThoughtProcess *string          `json:"aiThoughtProcess,omitempty"`
	ModelUsed        *string          `json:"modelUsed,omitempty"`
}

// InboxFilters - query params for GET /api/inbox/messages
type InboxFilters struct {
	ClientID  *int64  `query:"clientId"`
	Direction *string `query:"direction" validate:"omitempty,oneof=inbound outbound"`
	Search    *string `query:"search"`
	Limit     int     `query:"limit" validate:"min=1,max=100"`
	Offset    int     `query:"offset" validate:"min=0"`
}

// InboxStats - GET /api/inbox/stats
type InboxStats struct {
	Total       int `json:"total"`
	Inbound     int `json:"inbound"`
	Outbound    int `json:"outbound"`
	AIProcessed int `json:"aiProcessed"`
}

// --- Client/Tenant DTOs ---

// CreateClientRequest - POST /api/clients
type CreateClientRequest struct {
	Name       string `json:"name" validate:"required,min=2"`
	TokenLimit int    `json:"tokenLimit" validate:"min=0"`
	IsActive   bool   `json:"isActive"`
}

// UpdateClientRequest - PATCH /api/clients/:id
type UpdateClientRequest struct {
	Name       *string `json:"name,omitempty" validate:"omitempty,min=2"`
	TokenLimit *int    `json:"tokenLimit,omitempty" validate:"omitempty,min=0"`
	IsActive   *bool   `json:"isActive,omitempty"`
}

// UpdateClientAIConfigRequest - PUT /api/clients/:id/ai-config
type UpdateClientAIConfigRequest struct {
	ModelID         string  `json:"modelId" validate:"required"`
	SystemPrompt    string  `json:"systemPrompt" validate:"required,min=10,max=4000"`
	VectorNamespace *string `json:"vectorNamespace"`
	Temperature     float64 `json:"temperature" validate:"min=0,max=2"`
	MemoryTTLDays   int     `json:"memoryTtlDays" validate:"min=1,max=4"`
}

// --- System Diagnosis DTOs ---

// SystemHealthResponse - GET /api/system/health
type SystemHealthResponse struct {
	Services []ServiceHealth `json:"services"`
	Overall  ServiceStatus   `json:"overall"`
}

type ServiceHealth struct {
	ID          int64         `json:"id"`
	ServiceName string        `json:"serviceName"`
	Status      ServiceStatus `json:"status"`
	Latency     int           `json:"latency"`
	LastCheck   time.Time     `json:"lastCheck"`
}

// DiagnoseResponse - POST /api/system/diagnose
type DiagnoseResponse struct {
	Diagnosis       string           `json:"diagnosis"`
	Recommendations []Recommendation `json:"recommendations"`
}

type Recommendation struct {
	Severity string  `json:"severity"` // "critical", "warning", "info"
	Action   string  `json:"action"`
	Command  *string `json:"command,omitempty"`
}

// --- Generic Responses ---

type SuccessResponse struct {
	Success bool `json:"success"`
}

type ErrorResponse struct {
	Error   string                 `json:"error"`
	Code    string                 `json:"code,omitempty"`
	Details map[string]interface{} `json:"details,omitempty"`
}

// ===========================================
// WEBSOCKET MESSAGE TYPES
// ===========================================

// --- Inbox WebSocket (ws://.../api/inbox/live) ---

// InboxWSMessage - Server -> Client
type InboxWSMessage struct {
	Type             string           `json:"type"` // "message" | "stats_update"
	ID               string           `json:"id,omitempty"`
	ClientID         int64            `json:"clientId,omitempty"`
	ClientName       string           `json:"clientName,omitempty"`
	CustomerNumber   string           `json:"customerNumber,omitempty"`
	Message          string           `json:"message,omitempty"`
	Direction        MessageDirection `json:"direction,omitempty"`
	Timestamp        time.Time        `json:"timestamp,omitempty"`
	AIThoughtProcess *string          `json:"aiThoughtProcess,omitempty"`
	ModelUsed        *string          `json:"modelUsed,omitempty"`
	Stats            *InboxStats      `json:"stats,omitempty"` // For stats_update type
}

// InboxWSClientMessage - Client -> Server
type InboxWSClientMessage struct {
	Type     string `json:"type"` // "subscribe" | "unsubscribe"
	ClientID int64  `json:"clientId,omitempty"`
}

// --- QR Code WebSocket (ws://.../api/whatsapp/instances/:name/qr) ---

// QRWSMessage - Server -> Client
type QRWSMessage struct {
	Type        string  `json:"type"` // "qr" | "connected" | "timeout" | "error"
	QRCode      string  `json:"qrCode,omitempty"`      // Base64 encoded image for "qr"
	PhoneNumber string  `json:"phoneNumber,omitempty"` // For "connected"
	Message     string  `json:"message,omitempty"`     // For "error" or "timeout"
}

// QRWSClientMessage - Client -> Server
type QRWSClientMessage struct {
	Type string `json:"type"` // "refresh"
}

// ===========================================
// FIBER ROUTE HANDLERS EXAMPLE
// ===========================================

/*
Example Fiber route setup:

package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
)

func SetupRoutes(app *fiber.App) {
	api := app.Group("/api")

	// AI Providers
	providers := api.Group("/ai-providers")
	providers.Get("/", handlers.GetAIProviders)
	providers.Get("/models", handlers.GetAllModels)
	providers.Get("/:id", handlers.GetAIProvider)
	providers.Get("/:id/models", handlers.GetProviderModels)
	providers.Post("/", handlers.CreateAIProvider)
	providers.Patch("/:id", handlers.UpdateAIProvider)
	providers.Delete("/:id", handlers.DeleteAIProvider)
	providers.Put("/priorities", handlers.UpdateProviderPriorities)
	providers.Post("/:id/test", handlers.TestAIProvider)

	// WhatsApp Instances
	whatsapp := api.Group("/whatsapp/instances")
	whatsapp.Get("/", handlers.GetWhatsAppInstances)
	whatsapp.Get("/:id", handlers.GetWhatsAppInstance)
	whatsapp.Post("/", handlers.CreateWhatsAppInstance)
	whatsapp.Delete("/:id", handlers.DeleteWhatsAppInstance)
	whatsapp.Post("/:name/disconnect", handlers.DisconnectInstance)
	whatsapp.Get("/:name/status", handlers.GetInstanceStatus)
	whatsapp.Get("/:name/qr", websocket.New(handlers.QRCodeWebSocket))

	// Inbox
	inbox := api.Group("/inbox")
	inbox.Get("/messages", handlers.GetInboxMessages)
	inbox.Get("/stats", handlers.GetInboxStats)
	inbox.Get("/live", websocket.New(handlers.InboxLiveWebSocket))

	// Clients (Tenants)
	clients := api.Group("/clients")
	clients.Get("/", handlers.GetClients)
	clients.Get("/:id", handlers.GetClient)
	clients.Post("/", handlers.CreateClient)
	clients.Patch("/:id", handlers.UpdateClient)
	clients.Delete("/:id", handlers.DeleteClient)
	clients.Get("/:id/ai-config", handlers.GetClientAIConfig)
	clients.Put("/:id/ai-config", handlers.UpdateClientAIConfig)

	// System
	system := api.Group("/system")
	system.Get("/health", handlers.GetSystemHealth)
	system.Post("/diagnose", handlers.RunDiagnosis)
}
*/

// ===========================================
// VALIDATION TAGS REFERENCE
// ===========================================

/*
Validation tags used (github.com/go-playground/validator/v10):

- required: Field must be present
- min=N: Minimum length/value
- max=N: Maximum length/value
- gt=N: Greater than N
- gte=N: Greater than or equal to N
- url: Must be valid URL
- email: Must be valid email
- oneof=a b c: Must be one of the values
- alphanumdash: Only alphanumeric and dashes (custom)
- lowercase: Must be lowercase (custom)
- dive: Validate each element in slice

Custom validators needed:
- alphanumdash: ^[a-z0-9-]+$
- lowercase: strings.ToLower(s) == s
*/
