package models

import (
	"time"

	"gorm.io/gorm"
)

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

type User struct {
	ID           uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	Email        string    `json:"email" gorm:"uniqueIndex;not null"`
	PasswordHash string    `json:"-" gorm:"column:password;not null"`
	Role         UserRole  `json:"role" gorm:"type:text;default:'CLIENT_ADMIN'"`
	// ClientID scopes a CLIENT_ADMIN / STAFF user to a single tenant. NULL
	// is only legal for SUPER_ADMIN (cross-tenant operator). Tenant-scoped
	// handlers MUST reject requests whose claim.ClientID ≠ path :id unless
	// the user is SUPER_ADMIN.
	ClientID            *uint     `json:"clientId" gorm:"index"`
	MustChangePassword  bool      `json:"mustChangePassword" gorm:"default:false"`
	CreatedAt           time.Time `json:"createdAt"`
}

type Client struct {
	ID           uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	Name         string    `json:"name" gorm:"not null"`
	TokenBalance int       `json:"tokenBalance" gorm:"default:0"`
	TokenLimit   int       `json:"tokenLimit" gorm:"default:1000"`
	IsActive     bool      `json:"isActive" gorm:"default:true"`
	CreatedAt    time.Time `json:"createdAt"`
}

type AIProvider struct {
	ID           uint      `json:"id" gorm:"primaryKey;autoIncrement"`
	ClientID     *uint     `json:"clientId" gorm:"default:null"`
	ProviderName string    `json:"providerName" gorm:"not null"`
	APIKey       string    `json:"apiKey" gorm:"not null"`
	BaseURL      *string   `json:"baseUrl"`
	Priority     int       `json:"priority" gorm:"default:1"`
	IsActive     bool      `json:"isActive" gorm:"default:true"`
	LastError    *string   `json:"lastError"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type ClientAIConfig struct {
	ID              uint    `json:"id" gorm:"primaryKey;autoIncrement"`
	ClientID        uint    `json:"clientId" gorm:"uniqueIndex;not null"`
	ModelID         string  `json:"modelId" gorm:"not null"`
	SystemPrompt    string  `json:"systemPrompt" gorm:"not null"`
	VectorNamespace *string `json:"vectorNamespace"`
	Temperature     float64 `json:"temperature" gorm:"type:decimal(3,2);default:0.70"`
	MemoryTTLDays   int     `json:"memoryTtlDays" gorm:"default:4"`
}

type WhatsAppInstance struct {
	ID             uint           `json:"id" gorm:"primaryKey;autoIncrement"`
	ClientID       uint           `json:"clientId" gorm:"not null"`
	InstanceName   string         `json:"instanceName" gorm:"uniqueIndex;not null"`
	InstanceAPIKey *string        `json:"instanceApiKey"`
	WebhookURL     *string        `json:"webhookUrl"`
	Status         InstanceStatus `json:"status" gorm:"type:text;default:'DISCONNECTED'"`
	UpdatedAt      time.Time      `json:"updatedAt"`
}

type CustomerMemory struct {
	ID             uint                     `json:"id" gorm:"primaryKey;autoIncrement"`
	ClientID       uint                     `json:"clientId" gorm:"not null"`
	CustomerNumber string                   `json:"customerNumber" gorm:"not null"`
	Summary        *string                  `json:"summary"`
	RawHistory     []map[string]interface{} `json:"rawHistory" gorm:"type:jsonb;serializer:json"`
	ExpiresAt      time.Time                `json:"expiresAt" gorm:"not null"`
	UpdatedAt      time.Time                `json:"updatedAt"`
}

type SystemDiagnosis struct {
	ID          uint          `json:"id" gorm:"primaryKey;autoIncrement"`
	ServiceName string        `json:"serviceName" gorm:"not null"`
	Status      ServiceStatus `json:"status" gorm:"type:text"`
	Latency     int           `json:"latency"`
	LastCheck   time.Time     `json:"lastCheck"`
}

type InboxMessage struct {
	ID               string           `json:"id" gorm:"primaryKey"`
	ClientID         uint             `json:"clientId" gorm:"not null"`
	ClientName       string           `json:"clientName" gorm:"-"`
	CustomerNumber   string           `json:"customerNumber" gorm:"not null"`
	Message          string           `json:"message" gorm:"not null"`
	Direction        MessageDirection `json:"direction" gorm:"type:text;not null"`
	Timestamp        time.Time        `json:"timestamp"`
	AIThoughtProcess *string          `json:"aiThoughtProcess,omitempty"`
	ModelUsed        *string          `json:"modelUsed,omitempty"`
	Client           *Client          `json:"-" gorm:"foreignKey:ClientID"`
}

type AIModel struct {
	ID            string       `json:"id"`
	Name          string       `json:"name"`
	Provider      string       `json:"provider"`
	ContextLength int          `json:"contextLength"`
	Pricing       ModelPricing `json:"pricing"`
}

type ModelPricing struct {
	Input  float64 `json:"input"`
	Output float64 `json:"output"`
}

type ServiceHealth struct {
	ID          uint          `json:"id"`
	ServiceName string        `json:"serviceName"`
	Status      ServiceStatus `json:"status"`
	Latency     int           `json:"latency"`
	LastCheck   time.Time     `json:"lastCheck"`
}

func AutoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&User{},
		&Client{},
		&AIProvider{},
		&ClientAIConfig{},
		&WhatsAppInstance{},
		&CustomerMemory{},
		&SystemDiagnosis{},
		&InboxMessage{},
		// Knowledge base (Phase 2 — RAG foundation)
		&KnowledgeChunk{},
		&FAQ{},
		// Tool calling (Phase 4 — AI function calling)
		&ClientTool{},
	)
}
