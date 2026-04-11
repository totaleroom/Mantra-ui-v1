package handlers

import (
	"mantra-backend/database"
	"mantra-backend/models"
	"strconv"

	"github.com/gofiber/fiber/v2"
)

func GetClients(c *fiber.Ctx) error {
	if database.DB == nil {
		return c.JSON([]interface{}{})
	}
	var clients []models.Client
	if err := database.DB.Find(&clients).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch clients",
			"code":  "INTERNAL_ERROR",
		})
	}
	return c.JSON(clients)
}

func GetClient(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	if database.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "Database not connected"})
	}

	var client models.Client
	if err := database.DB.First(&client, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Client not found", "code": "NOT_FOUND"})
	}
	return c.JSON(client)
}

func CreateClient(c *fiber.Ctx) error {
	type CreateReq struct {
		Name       string `json:"name"`
		TokenLimit int    `json:"tokenLimit"`
		IsActive   bool   `json:"isActive"`
	}

	var req CreateReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body"})
	}
	if len(req.Name) < 2 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Name must be at least 2 characters", "code": "VALIDATION_ERROR"})
	}

	if database.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "Database not connected"})
	}

	client := models.Client{
		Name:       req.Name,
		TokenLimit: req.TokenLimit,
		IsActive:   req.IsActive,
	}
	if err := database.DB.Create(&client).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create client"})
	}
	return c.Status(fiber.StatusCreated).JSON(client)
}

func UpdateClient(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	if database.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "Database not connected"})
	}

	var client models.Client
	if err := database.DB.First(&client, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Client not found"})
	}

	type UpdateReq struct {
		Name       *string `json:"name"`
		TokenLimit *int    `json:"tokenLimit"`
		IsActive   *bool   `json:"isActive"`
	}
	var req UpdateReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body"})
	}
	if req.Name != nil {
		client.Name = *req.Name
	}
	if req.TokenLimit != nil {
		client.TokenLimit = *req.TokenLimit
	}
	if req.IsActive != nil {
		client.IsActive = *req.IsActive
	}

	database.DB.Save(&client)
	return c.JSON(client)
}

func DeleteClient(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	if database.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "Database not connected"})
	}

	if err := database.DB.Delete(&models.Client{}, id).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete client"})
	}
	return c.JSON(fiber.Map{"success": true})
}

func GetClientAIConfig(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	if database.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "Database not connected"})
	}

	var config models.ClientAIConfig
	if err := database.DB.Where("client_id = ?", id).First(&config).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "AI config not found", "code": "NOT_FOUND"})
	}
	return c.JSON(config)
}

func UpdateClientAIConfig(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	if database.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "Database not connected"})
	}

	type UpdateReq struct {
		ModelID         string  `json:"modelId"`
		SystemPrompt    string  `json:"systemPrompt"`
		VectorNamespace *string `json:"vectorNamespace"`
		Temperature     float64 `json:"temperature"`
		MemoryTTLDays   int     `json:"memoryTtlDays"`
	}
	var req UpdateReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body"})
	}

	if req.ModelID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "modelId is required"})
	}
	if len(req.SystemPrompt) < 10 || len(req.SystemPrompt) > 4000 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "systemPrompt must be 10-4000 characters"})
	}
	if req.Temperature < 0 || req.Temperature > 2 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "temperature must be 0-2"})
	}
	if req.MemoryTTLDays < 1 || req.MemoryTTLDays > 4 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "memoryTtlDays must be 1-4"})
	}

	var config models.ClientAIConfig
	result := database.DB.Where("client_id = ?", id).First(&config)

	if result.Error != nil {
		config = models.ClientAIConfig{ClientID: uint(id)}
	}

	config.ModelID = req.ModelID
	config.SystemPrompt = req.SystemPrompt
	config.VectorNamespace = req.VectorNamespace
	config.Temperature = req.Temperature
	config.MemoryTTLDays = req.MemoryTTLDays

	database.DB.Save(&config)
	return c.JSON(config)
}
