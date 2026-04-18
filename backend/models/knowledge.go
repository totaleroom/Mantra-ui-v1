package models

import "time"

// KnowledgeChunk is a single vectorised fragment of a tenant's knowledge
// base. Chunks are created by ingesting larger text and embedding them so
// they can be retrieved by cosine similarity at AI-reply time.
//
// The `embedding` pgvector column is intentionally NOT mapped to a Go
// field — GORM doesn't speak pgvector. All embedding writes/reads go via
// raw SQL (see handlers/knowledge.go and services/retrieval.go). GORM is
// used for metadata columns only.
type KnowledgeChunk struct {
	ID         uint64    `json:"id"         gorm:"primaryKey;autoIncrement"`
	ClientID   uint      `json:"clientId"   gorm:"not null;index"`
	Content    string    `json:"content"    gorm:"not null;type:text"`
	Source     *string   `json:"source"`
	Category   *string   `json:"category"`
	Metadata   JSONB     `json:"metadata"   gorm:"type:jsonb;serializer:json;default:'{}'::jsonb"`
	TokenCount *int      `json:"tokenCount" gorm:"column:token_count"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

func (KnowledgeChunk) TableName() string { return "client_knowledge_chunks" }

// FAQ is a human-authored, structured question+answer for a tenant.
// Matched by trigger keywords / tags before vector retrieval because
// exact-match Q&A is higher quality for known questions.
//
// Tags and TriggerKeywords are stored as JSONB arrays in Postgres (not
// TEXT[]) so GORM's built-in json serializer can handle them without
// pulling in lib/pq. Query with @> or ? operators.
type FAQ struct {
	ID              uint64    `json:"id"              gorm:"primaryKey;autoIncrement"`
	ClientID        uint      `json:"clientId"        gorm:"not null;index"`
	Question        string    `json:"question"        gorm:"not null;type:text"`
	Answer          string    `json:"answer"          gorm:"not null;type:text"`
	Tags            []string  `json:"tags"            gorm:"type:jsonb;serializer:json;default:'[]'::jsonb"`
	Priority        int       `json:"priority"        gorm:"default:0"`
	IsActive        bool      `json:"isActive"        gorm:"default:true"`
	TriggerKeywords []string  `json:"triggerKeywords" gorm:"type:jsonb;serializer:json;default:'[]'::jsonb;column:trigger_keywords"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

func (FAQ) TableName() string { return "client_faqs" }

// JSONB is a thin alias so GORM treats metadata as a jsonb column via
// its built-in json serializer. Callers can set it to any map/struct.
type JSONB map[string]interface{}

// KnowledgeStats is the per-client aggregate returned by
// GET /api/clients/:id/knowledge/stats.
type KnowledgeStats struct {
	ClientID         uint       `json:"clientId"`
	TotalChunks      int        `json:"totalChunks"`
	TotalFAQs        int        `json:"totalFaqs"`
	ActiveFAQs       int        `json:"activeFaqs"`
	LastChunkAddedAt *time.Time `json:"lastChunkAddedAt,omitempty"`
	LastFAQUpdatedAt *time.Time `json:"lastFaqUpdatedAt,omitempty"`
}
