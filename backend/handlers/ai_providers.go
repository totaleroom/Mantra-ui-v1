package handlers

import (
	"mantra-backend/database"
	"mantra-backend/models"
	"mantra-backend/services"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
)

var aiService = services.NewAIFallbackService()

func GetAIProviders(c *fiber.Ctx) error {
	if database.DB == nil {
		return c.JSON([]interface{}{})
	}
	var providers []models.AIProvider
	if err := database.DB.Order("priority asc").Find(&providers).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch providers",
			"code":  "INTERNAL_ERROR",
		})
	}
	return c.JSON(providers)
}

func GetAIProvider(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID", "code": "BAD_REQUEST"})
	}

	if database.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "Database not connected"})
	}

	var p models.AIProvider
	if err := database.DB.First(&p, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Provider not found", "code": "NOT_FOUND"})
	}
	return c.JSON(p)
}

func CreateAIProvider(c *fiber.Ctx) error {
	type CreateReq struct {
		ProviderName string  `json:"providerName"`
		APIKey       string  `json:"apiKey"`
		BaseURL      *string `json:"baseUrl"`
		Priority     int     `json:"priority"`
		IsActive     bool    `json:"isActive"`
		ClientID     *uint   `json:"clientId"`
	}

	var req CreateReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body", "code": "BAD_REQUEST"})
	}
	if req.ProviderName == "" || req.APIKey == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "providerName and apiKey are required", "code": "VALIDATION_ERROR"})
	}
	if req.Priority < 1 {
		req.Priority = 1
	}

	if database.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "Database not connected"})
	}

	p := models.AIProvider{
		ClientID:     req.ClientID,
		ProviderName: req.ProviderName,
		APIKey:       req.APIKey,
		BaseURL:      req.BaseURL,
		Priority:     req.Priority,
		IsActive:     req.IsActive,
		UpdatedAt:    time.Now(),
	}
	if err := database.DB.Create(&p).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create provider", "code": "INTERNAL_ERROR"})
	}
	return c.Status(fiber.StatusCreated).JSON(p)
}

func UpdateAIProvider(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	if database.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "Database not connected"})
	}

	var p models.AIProvider
	if err := database.DB.First(&p, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Provider not found", "code": "NOT_FOUND"})
	}

	type UpdateReq struct {
		ProviderName *string `json:"providerName"`
		APIKey       *string `json:"apiKey"`
		BaseURL      *string `json:"baseUrl"`
		Priority     *int    `json:"priority"`
		IsActive     *bool   `json:"isActive"`
	}
	var req UpdateReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body"})
	}

	if req.ProviderName != nil {
		p.ProviderName = *req.ProviderName
	}
	if req.APIKey != nil {
		p.APIKey = *req.APIKey
	}
	if req.BaseURL != nil {
		p.BaseURL = req.BaseURL
	}
	if req.Priority != nil {
		p.Priority = *req.Priority
	}
	if req.IsActive != nil {
		p.IsActive = *req.IsActive
	}
	p.UpdatedAt = time.Now()

	database.DB.Save(&p)
	return c.JSON(p)
}

func DeleteAIProvider(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	if database.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "Database not connected"})
	}

	if err := database.DB.Delete(&models.AIProvider{}, id).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete"})
	}
	return c.JSON(fiber.Map{"success": true})
}

func UpdateProviderPriorities(c *fiber.Ctx) error {
	type PriorityItem struct {
		ID       uint `json:"id"`
		Priority int  `json:"priority"`
	}
	type Req struct {
		Priorities []PriorityItem `json:"priorities"`
	}

	var req Req
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body"})
	}

	if database.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "Database not connected"})
	}

	for _, item := range req.Priorities {
		database.DB.Model(&models.AIProvider{}).Where("id = ?", item.ID).Update("priority", item.Priority)
	}
	return c.JSON(fiber.Map{"success": true})
}

func TestAIProvider(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	latency, testErr := aiService.TestProvider(uint(id))
	if testErr != nil {
		errMsg := testErr.Error()
		return c.JSON(fiber.Map{
			"success": false,
			"latency": latency,
			"error":   errMsg,
		})
	}
	return c.JSON(fiber.Map{
		"success": true,
		"latency": latency,
		"error":   nil,
	})
}

func GetAllModels(c *fiber.Ctx) error {
	if database.DB == nil {
		return c.JSON([]interface{}{})
	}

	var providers []models.AIProvider
	database.DB.Where("is_active = ?", true).Find(&providers)

	staticModels := []models.AIModel{
		{ID: "gpt-4-turbo", Name: "GPT-4 Turbo", Provider: "OpenAI", ContextLength: 128000, Pricing: models.ModelPricing{Input: 0.01, Output: 0.03}},
		{ID: "gpt-4o", Name: "GPT-4o", Provider: "OpenAI", ContextLength: 128000, Pricing: models.ModelPricing{Input: 0.005, Output: 0.015}},
		{ID: "gpt-3.5-turbo", Name: "GPT-3.5 Turbo", Provider: "OpenAI", ContextLength: 16385, Pricing: models.ModelPricing{Input: 0.0005, Output: 0.0015}},
		{ID: "claude-3-opus-20240229", Name: "Claude 3 Opus", Provider: "Anthropic", ContextLength: 200000, Pricing: models.ModelPricing{Input: 0.015, Output: 0.075}},
		{ID: "claude-3-sonnet-20240229", Name: "Claude 3 Sonnet", Provider: "Anthropic", ContextLength: 200000, Pricing: models.ModelPricing{Input: 0.003, Output: 0.015}},
		{ID: "llama3-8b-8192", Name: "Llama 3 8B", Provider: "Groq", ContextLength: 8192, Pricing: models.ModelPricing{Input: 0.0001, Output: 0.0001}},
		{ID: "llama3-70b-8192", Name: "Llama 3 70B", Provider: "Groq", ContextLength: 8192, Pricing: models.ModelPricing{Input: 0.00059, Output: 0.00079}},
		{ID: "mixtral-8x7b-32768", Name: "Mixtral 8x7B", Provider: "Groq", ContextLength: 32768, Pricing: models.ModelPricing{Input: 0.00027, Output: 0.00027}},
	}
	return c.JSON(staticModels)
}

func GetProviderModels(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	if database.DB == nil {
		return c.JSON([]interface{}{})
	}

	var p models.AIProvider
	if err := database.DB.First(&p, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Provider not found"})
	}

	fetchedModels, err := aiService.FetchModels(p)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error": "Failed to fetch models from provider: " + err.Error(),
			"code":  "UPSTREAM_ERROR",
		})
	}
	return c.JSON(fetchedModels)
}
