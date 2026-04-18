package handlers

import (
	"mantra-backend/database"
	"mantra-backend/models"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v2"
)

// Client tools CRUD — Phase 4 of the commercial MVP roadmap. Endpoints
// are tenant-scoped via the :id path param (client id). Matches the
// pattern used by knowledge.go for consistency.

type toolRequest struct {
	Name             string                 `json:"name"`
	Description      string                 `json:"description"`
	ParametersSchema map[string]interface{} `json:"parametersSchema"`
	HandlerType      string                 `json:"handlerType"`
	HandlerConfig    map[string]interface{} `json:"handlerConfig"`
	IsActive         *bool                  `json:"isActive"`
	TimeoutMs        int                    `json:"timeoutMs"`
}

// validateToolRequest enforces basic invariants before writing. Returns a
// human-friendly error string or "" when valid.
func validateToolRequest(t *toolRequest, isUpdate bool) string {
	if !isUpdate || t.Name != "" {
		if t.Name == "" {
			return "name is required"
		}
		// Tool names are fed to the LLM — enforce snake_case-ish to keep
		// prompts tidy and avoid ambiguous quoting.
		for _, r := range t.Name {
			if !((r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_') {
				return "name must contain only lowercase letters, digits, and underscores"
			}
		}
	}
	if !isUpdate && strings.TrimSpace(t.Description) == "" {
		return "description is required (LLM needs it to decide when to call)"
	}
	switch t.HandlerType {
	case "", models.HandlerTypeBuiltin, models.HandlerTypeWebhook:
		// ok
	default:
		return "handlerType must be 'builtin' or 'webhook'"
	}
	if t.HandlerType == models.HandlerTypeWebhook {
		if t.HandlerConfig == nil {
			return "handlerConfig.url is required for webhook tools"
		}
		url, _ := t.HandlerConfig["url"].(string)
		if url == "" {
			return "handlerConfig.url is required for webhook tools"
		}
		if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
			return "handlerConfig.url must start with http:// or https://"
		}
	}
	if t.HandlerType == models.HandlerTypeBuiltin {
		if t.HandlerConfig == nil {
			return "handlerConfig.name is required for builtin tools"
		}
		name, _ := t.HandlerConfig["name"].(string)
		if name == "" {
			return "handlerConfig.name is required for builtin tools"
		}
	}
	if t.TimeoutMs != 0 && (t.TimeoutMs < 1000 || t.TimeoutMs > 30000) {
		return "timeoutMs must be between 1000 and 30000"
	}
	return ""
}

// POST /api/clients/:id/tools
func CreateTool(c *fiber.Ctx) error {
	clientID, err := clientIDParam(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	var body toolRequest
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	if msg := validateToolRequest(&body, false); msg != "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": msg})
	}

	var client models.Client
	if err := database.DB.First(&client, clientID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "client not found"})
	}

	tool := models.ClientTool{
		ClientID:         clientID,
		Name:             strings.TrimSpace(body.Name),
		Description:      strings.TrimSpace(body.Description),
		ParametersSchema: models.JSONB(body.ParametersSchema),
		HandlerType:      body.HandlerType,
		HandlerConfig:    models.JSONB(body.HandlerConfig),
		IsActive:         true,
		TimeoutMs:        body.TimeoutMs,
	}
	if tool.HandlerType == "" {
		tool.HandlerType = models.HandlerTypeWebhook
	}
	if tool.TimeoutMs == 0 {
		tool.TimeoutMs = 8000
	}
	if body.IsActive != nil {
		tool.IsActive = *body.IsActive
	}

	if err := database.DB.Create(&tool).Error; err != nil {
		// Most likely the UNIQUE (client_id, name) constraint.
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"error": err.Error()})
	}
	return c.Status(fiber.StatusCreated).JSON(tool)
}

// GET /api/clients/:id/tools
func ListTools(c *fiber.Ctx) error {
	clientID, err := clientIDParam(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}

	var tools []models.ClientTool
	if err := database.DB.
		Where("client_id = ?", clientID).
		Order("is_active DESC, id DESC").
		Find(&tools).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(fiber.Map{"tools": tools})
}

// PATCH /api/clients/:id/tools/:toolId
func UpdateTool(c *fiber.Ctx) error {
	clientID, err := clientIDParam(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	toolID, err := strconv.ParseUint(c.Params("toolId"), 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid tool id"})
	}

	var body toolRequest
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid JSON body"})
	}
	if msg := validateToolRequest(&body, true); msg != "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": msg})
	}

	var tool models.ClientTool
	if err := database.DB.
		Where("id = ? AND client_id = ?", toolID, clientID).
		First(&tool).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "tool not found"})
	}

	if body.Name != "" {
		tool.Name = strings.TrimSpace(body.Name)
	}
	if body.Description != "" {
		tool.Description = strings.TrimSpace(body.Description)
	}
	if body.ParametersSchema != nil {
		tool.ParametersSchema = models.JSONB(body.ParametersSchema)
	}
	if body.HandlerType != "" {
		tool.HandlerType = body.HandlerType
	}
	if body.HandlerConfig != nil {
		tool.HandlerConfig = models.JSONB(body.HandlerConfig)
	}
	if body.IsActive != nil {
		tool.IsActive = *body.IsActive
	}
	if body.TimeoutMs != 0 {
		tool.TimeoutMs = body.TimeoutMs
	}

	if err := database.DB.Save(&tool).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(tool)
}

// DELETE /api/clients/:id/tools/:toolId
func DeleteTool(c *fiber.Ctx) error {
	clientID, err := clientIDParam(c)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": err.Error()})
	}
	toolID, err := strconv.ParseUint(c.Params("toolId"), 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "invalid tool id"})
	}

	res := database.DB.
		Where("id = ? AND client_id = ?", toolID, clientID).
		Delete(&models.ClientTool{})
	if res.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": res.Error.Error()})
	}
	if res.RowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "tool not found"})
	}
	return c.JSON(fiber.Map{"deleted": true, "id": toolID})
}
