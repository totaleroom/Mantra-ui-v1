package handlers

import (
	"fmt"
	"mantra-backend/database"
	"mantra-backend/models"
	"mantra-backend/services"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

// Knowledge base HTTP handlers — Phase 2 of the commercial MVP roadmap.
//
// All endpoints are tenant-scoped via the :id path param (client id).
// Request-level authorization is enforced by middleware.JWTProtected.
// If you add tenant-level RBAC later, gate it here by comparing the
// JWT's clientID claim against the :id param.

// ----- Helpers ---------------------------------------------------------

// clientIDParam parses and validates the :id path param.
func clientIDParam(c *fiber.Ctx) (uint, error) {
	raw := c.Params("id")
	n, err := strconv.ParseUint(raw, 10, 32)
	if err != nil || n == 0 {
		return 0, fmt.Errorf("invalid client id")
	}
	return uint(n), nil
}

// chunkText splits a long body into ~2000-character chunks, trying to
// respect paragraph boundaries. This is intentionally simple: no tokenizer
// dependency. 2000 chars ~ 500 tokens for English / Indonesian prose.
const (
	maxChunkChars = 2000
	minChunkChars = 80
)

func chunkText(body string) []string {
	body = strings.TrimSpace(body)
	if len(body) == 0 {
		return nil
	}
	if len(body) <= maxChunkChars {
		return []string{body}
	}

	// Split on paragraph breaks first, then repack into <= maxChunkChars.
	paragraphs := strings.Split(body, "\n\n")
	var out []string
	var current strings.Builder
	for _, p := range paragraphs {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		// Hard-split oversized paragraphs (rare but not crash-worthy)
		for len(p) > maxChunkChars {
			// Try to break at a sentence boundary in the last 200 chars
			cut := maxChunkChars
			for i := maxChunkChars; i > maxChunkChars-200 && i > 0; i-- {
				if p[i-1] == '.' || p[i-1] == '!' || p[i-1] == '?' {
					cut = i
					break
				}
			}
			if current.Len() > 0 {
				out = append(out, strings.TrimSpace(current.String()))
				current.Reset()
			}
			out = append(out, strings.TrimSpace(p[:cut]))
			p = p[cut:]
		}
		// Would adding this paragraph overflow the current buffer?
		if current.Len()+len(p)+2 > maxChunkChars && current.Len() > 0 {
			out = append(out, strings.TrimSpace(current.String()))
			current.Reset()
		}
		if current.Len() > 0 {
			current.WriteString("\n\n")
		}
		current.WriteString(p)
	}
	if current.Len() >= minChunkChars || (current.Len() > 0 && len(out) == 0) {
		out = append(out, strings.TrimSpace(current.String()))
	}
	return out
}

// approxTokens is an intentionally conservative upper bound (4 chars ~ 1 token)
func approxTokens(s string) int {
	return (len(s) + 3) / 4
}

// ----- Knowledge Chunks -----------------------------------------------

type uploadChunksRequest struct {
	Text     string                 `json:"text"`
	Source   *string                `json:"source"`
	Category *string                `json:"category"`
	Metadata map[string]interface{} `json:"metadata"`
	Model    string                 `json:"model"` // optional override
}

type uploadChunksResponse struct {
	ClientID    uint    `json:"clientId"`
	ChunksAdded int     `json:"chunksAdded"`
	ChunkIDs    []int64 `json:"chunkIds"`
	Provider    string  `json:"provider"`
	Model       string  `json:"model"`
}

// POST /api/clients/:id/knowledge/chunks
// Accepts a body of text, splits it, embeds each chunk via the configured
// provider, and persists each chunk with its vector.
func UploadKnowledgeChunks(c *fiber.Ctx) error {
	clientID, err := clientIDParam(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	var body uploadChunksRequest
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	if strings.TrimSpace(body.Text) == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "text is required"})
	}

	// Verify client exists (prevents silently writing under invalid tenant).
	var client models.Client
	if err := database.DB.First(&client, clientID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "client not found"})
	}

	chunks := chunkText(body.Text)
	if len(chunks) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "text produced no chunks"})
	}

	embed := services.NewEmbeddingService()
	vectors, provider, err := embed.Embed(&clientID, body.Model, chunks)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{"error": err.Error()})
	}

	// Marshal metadata — GORM's jsonb serializer expects a Go value;
	// we use raw SQL for the INSERT because of pgvector, so we build
	// the JSON ourselves via PostgreSQL's to_jsonb() during insert.

	tx := database.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
			panic(r)
		}
	}()

	var ids []int64
	source := ""
	if body.Source != nil {
		source = *body.Source
	}
	category := ""
	if body.Category != nil {
		category = *body.Category
	}
	metadataJSON := "{}"
	if body.Metadata != nil {
		if b, err := json.Marshal(body.Metadata); err == nil {
			metadataJSON = string(b)
		}
	}

	for i, chunk := range chunks {
		var id int64
		toks := approxTokens(chunk)
		if err := tx.Raw(`
			INSERT INTO client_knowledge_chunks
			  (client_id, content, embedding, source, category, metadata, token_count, created_at, updated_at)
			VALUES ($1, $2, $3::vector, $4, $5, $6::jsonb, $7, NOW(), NOW())
			RETURNING id
		`, clientID, chunk, services.VectorLiteral(vectors[i]),
			nullStr(source), nullStr(category), metadataJSON, toks).
			Scan(&id).Error; err != nil {
			tx.Rollback()
			return c.Status(fiber.StatusInternalServerError).
				JSON(fiber.Map{"error": "insert failed: " + err.Error()})
		}
		ids = append(ids, id)
	}

	if err := tx.Commit().Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).
			JSON(fiber.Map{"error": "commit failed: " + err.Error()})
	}

	return c.JSON(uploadChunksResponse{
		ClientID:    clientID,
		ChunksAdded: len(ids),
		ChunkIDs:    ids,
		Provider:    provider,
		Model:       firstNonEmpty(body.Model, services.DefaultEmbeddingModel),
	})
}

// GET /api/clients/:id/knowledge/chunks?limit=50&offset=0&category=xxx
func ListKnowledgeChunks(c *fiber.Ctx) error {
	clientID, err := clientIDParam(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	if offset < 0 {
		offset = 0
	}
	category := c.Query("category", "")

	query := database.DB.
		Table("client_knowledge_chunks").
		Where("client_id = ?", clientID)
	if category != "" {
		query = query.Where("category = ?", category)
	}

	var total int64
	query.Count(&total)

	var chunks []models.KnowledgeChunk
	if err := query.
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&chunks).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).
			JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"total":  total,
		"limit":  limit,
		"offset": offset,
		"chunks": chunks,
	})
}

// DELETE /api/clients/:id/knowledge/chunks/:chunkId
func DeleteKnowledgeChunk(c *fiber.Ctx) error {
	clientID, err := clientIDParam(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	chunkID, err := strconv.ParseUint(c.Params("chunkId"), 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid chunk id"})
	}

	res := database.DB.
		Where("id = ? AND client_id = ?", chunkID, clientID).
		Delete(&models.KnowledgeChunk{})
	if res.Error != nil {
		return c.Status(fiber.StatusInternalServerError).
			JSON(fiber.Map{"error": res.Error.Error()})
	}
	if res.RowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).
			JSON(fiber.Map{"error": "chunk not found"})
	}
	return c.JSON(fiber.Map{"deleted": true, "id": chunkID})
}

// ----- FAQ ------------------------------------------------------------

type faqRequest struct {
	Question        string   `json:"question"`
	Answer          string   `json:"answer"`
	Tags            []string `json:"tags"`
	TriggerKeywords []string `json:"triggerKeywords"`
	Priority        int      `json:"priority"`
	IsActive        *bool    `json:"isActive"`
}

// POST /api/clients/:id/knowledge/faqs
func CreateFAQ(c *fiber.Ctx) error {
	clientID, err := clientIDParam(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	var body faqRequest
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	if strings.TrimSpace(body.Question) == "" || strings.TrimSpace(body.Answer) == "" {
		return c.Status(fiber.StatusBadRequest).
			JSON(fiber.Map{"error": "question and answer are required"})
	}

	// Verify client exists
	var client models.Client
	if err := database.DB.First(&client, clientID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "client not found"})
	}

	faq := models.FAQ{
		ClientID:        clientID,
		Question:        strings.TrimSpace(body.Question),
		Answer:          strings.TrimSpace(body.Answer),
		Tags:            normalizeStringSlice(body.Tags),
		TriggerKeywords: normalizeStringSlice(body.TriggerKeywords),
		Priority:        body.Priority,
		IsActive:        true,
	}
	if body.IsActive != nil {
		faq.IsActive = *body.IsActive
	}
	if err := database.DB.Create(&faq).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(faq)
}

// GET /api/clients/:id/knowledge/faqs
func ListFAQs(c *fiber.Ctx) error {
	clientID, err := clientIDParam(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	includeInactive := c.Query("includeInactive", "false") == "true"

	query := database.DB.Where("client_id = ?", clientID)
	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}

	var faqs []models.FAQ
	if err := query.Order("priority DESC, id DESC").Find(&faqs).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"faqs": faqs})
}

// PATCH /api/clients/:id/knowledge/faqs/:faqId
func UpdateFAQ(c *fiber.Ctx) error {
	clientID, err := clientIDParam(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	faqID, err := strconv.ParseUint(c.Params("faqId"), 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid faq id"})
	}
	var body faqRequest
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}

	var faq models.FAQ
	if err := database.DB.
		Where("id = ? AND client_id = ?", faqID, clientID).
		First(&faq).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "faq not found"})
	}

	if strings.TrimSpace(body.Question) != "" {
		faq.Question = strings.TrimSpace(body.Question)
	}
	if strings.TrimSpace(body.Answer) != "" {
		faq.Answer = strings.TrimSpace(body.Answer)
	}
	if body.Tags != nil {
		faq.Tags = normalizeStringSlice(body.Tags)
	}
	if body.TriggerKeywords != nil {
		faq.TriggerKeywords = normalizeStringSlice(body.TriggerKeywords)
	}
	if body.Priority != 0 {
		faq.Priority = body.Priority
	}
	if body.IsActive != nil {
		faq.IsActive = *body.IsActive
	}
	faq.UpdatedAt = time.Now()

	if err := database.DB.Save(&faq).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(faq)
}

// DELETE /api/clients/:id/knowledge/faqs/:faqId
func DeleteFAQ(c *fiber.Ctx) error {
	clientID, err := clientIDParam(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	faqID, err := strconv.ParseUint(c.Params("faqId"), 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid faq id"})
	}
	res := database.DB.
		Where("id = ? AND client_id = ?", faqID, clientID).
		Delete(&models.FAQ{})
	if res.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": res.Error.Error()})
	}
	if res.RowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "faq not found"})
	}
	return c.JSON(fiber.Map{"deleted": true, "id": faqID})
}

// ----- Stats ---------------------------------------------------------

// GET /api/clients/:id/knowledge/stats
func GetKnowledgeStats(c *fiber.Ctx) error {
	clientID, err := clientIDParam(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	stats := models.KnowledgeStats{ClientID: clientID}

	var chunkCount int64
	database.DB.Model(&models.KnowledgeChunk{}).
		Where("client_id = ?", clientID).
		Count(&chunkCount)
	stats.TotalChunks = int(chunkCount)

	var faqCount, activeFAQCount int64
	database.DB.Model(&models.FAQ{}).
		Where("client_id = ?", clientID).
		Count(&faqCount)
	database.DB.Model(&models.FAQ{}).
		Where("client_id = ? AND is_active = ?", clientID, true).
		Count(&activeFAQCount)
	stats.TotalFAQs = int(faqCount)
	stats.ActiveFAQs = int(activeFAQCount)

	var lastChunk models.KnowledgeChunk
	if err := database.DB.
		Where("client_id = ?", clientID).
		Order("created_at DESC").
		First(&lastChunk).Error; err == nil {
		stats.LastChunkAddedAt = &lastChunk.CreatedAt
	}

	var lastFAQ models.FAQ
	if err := database.DB.
		Where("client_id = ?", clientID).
		Order("updated_at DESC").
		First(&lastFAQ).Error; err == nil {
		stats.LastFAQUpdatedAt = &lastFAQ.UpdatedAt
	}

	return c.JSON(stats)
}

// ----- small utilities ----------------------------------------------

func nullStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

func normalizeStringSlice(in []string) []string {
	if in == nil {
		return []string{}
	}
	out := make([]string, 0, len(in))
	seen := map[string]bool{}
	for _, s := range in {
		s = strings.TrimSpace(s)
		if s == "" || seen[s] {
			continue
		}
		seen[s] = true
		out = append(out, s)
	}
	return out
}
}
