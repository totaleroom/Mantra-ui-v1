package models

import "time"

// ClientTool is a per-tenant function the AI may invoke during an inbound
// reply loop. Phase 4 of the commercial MVP roadmap.
//
// Supported handler_type values:
//
//   "builtin"  handler_config = {"name": "<go_handler_key>"}
//              Resolved to a compiled-in Go function. Safe, no I/O risk.
//
//   "webhook"  handler_config = {"url": "https://...", "secret": "...?"}
//              Backend POSTs to url with JSON body
//                 { "customer": "<phone>", "args": {...}, "clientId": N }
//              and uses the HTTP response body (trimmed to 8 KiB) as the
//              tool result. If `secret` is set, it's sent as
//              `X-Mantra-Secret` header for webhook verification.
//
// ParametersSchema must be a JSON Schema object (OpenAI function-calling
// convention). Empty {} means "no arguments".
type ClientTool struct {
	ID               uint64    `json:"id"               gorm:"primaryKey;autoIncrement"`
	ClientID         uint      `json:"clientId"         gorm:"not null;index;uniqueIndex:idx_client_tool_name"`
	Name             string    `json:"name"             gorm:"not null;uniqueIndex:idx_client_tool_name"`
	Description      string    `json:"description"      gorm:"not null;type:text"`
	ParametersSchema JSONB     `json:"parametersSchema" gorm:"type:jsonb;serializer:json;default:'{}'::jsonb;column:parameters_schema"`
	HandlerType      string    `json:"handlerType"      gorm:"not null;default:'webhook';column:handler_type"`
	HandlerConfig    JSONB     `json:"handlerConfig"    gorm:"type:jsonb;serializer:json;default:'{}'::jsonb;column:handler_config"`
	IsActive         bool      `json:"isActive"         gorm:"default:true"`
	TimeoutMs        int       `json:"timeoutMs"        gorm:"default:8000;column:timeout_ms"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

func (ClientTool) TableName() string { return "client_tools" }

// HandlerTypeBuiltin / HandlerTypeWebhook — documented string constants
// so handlers and services reference the same values (typo-safe).
const (
	HandlerTypeBuiltin = "builtin"
	HandlerTypeWebhook = "webhook"
)
