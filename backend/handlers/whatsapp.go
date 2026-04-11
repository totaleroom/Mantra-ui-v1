package handlers

import (
	"mantra-backend/database"
	"mantra-backend/models"
	"mantra-backend/services"
	"regexp"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
)

var evolutionService = services.NewEvolutionService()
var instanceNameRegex = regexp.MustCompile(`^[a-z0-9-]+$`)

func GetWhatsAppInstances(c *fiber.Ctx) error {
	if database.DB == nil {
		return c.JSON([]interface{}{})
	}
	var instances []models.WhatsAppInstance
	if err := database.DB.Find(&instances).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch instances",
			"code":  "INTERNAL_ERROR",
		})
	}
	return c.JSON(instances)
}

func GetWhatsAppInstance(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	if database.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "Database not connected"})
	}

	var instance models.WhatsAppInstance
	if err := database.DB.First(&instance, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Instance not found", "code": "NOT_FOUND"})
	}
	return c.JSON(instance)
}

func CreateWhatsAppInstance(c *fiber.Ctx) error {
	type CreateReq struct {
		InstanceName string  `json:"instanceName"`
		ClientID     uint    `json:"clientId"`
		WebhookURL   *string `json:"webhookUrl"`
	}

	var req CreateReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body"})
	}

	if len(req.InstanceName) < 3 || len(req.InstanceName) > 50 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "instanceName must be 3-50 characters",
			"code":  "VALIDATION_ERROR",
		})
	}
	if !instanceNameRegex.MatchString(req.InstanceName) {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "instanceName must contain only lowercase letters, numbers, and hyphens",
			"code":  "VALIDATION_ERROR",
		})
	}
	if req.ClientID == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "clientId is required",
			"code":  "VALIDATION_ERROR",
		})
	}

	if database.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "Database not connected"})
	}

	webhookURL := ""
	if req.WebhookURL != nil {
		webhookURL = *req.WebhookURL
	}

	evoInstance, err := evolutionService.CreateInstance(req.InstanceName, webhookURL)
	
	instance := models.WhatsAppInstance{
		ClientID:     req.ClientID,
		InstanceName: req.InstanceName,
		WebhookURL:   req.WebhookURL,
		Status:       models.InstanceStatusConnecting,
		UpdatedAt:    time.Now(),
	}

	if err == nil && evoInstance != nil {
		apiKey := evoInstance.APIKey
		instance.InstanceAPIKey = &apiKey
	}

	if err != nil {
		instance.Status = models.InstanceStatusDisconnected
	}

	if dbErr := database.DB.Create(&instance).Error; dbErr != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create instance"})
	}

	return c.Status(fiber.StatusCreated).JSON(instance)
}

func DeleteWhatsAppInstance(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	if database.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"error": "Database not connected"})
	}

	var instance models.WhatsAppInstance
	if err := database.DB.First(&instance, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Instance not found"})
	}

	evolutionService.DeleteInstance(instance.InstanceName)

	database.DB.Delete(&instance)
	return c.JSON(fiber.Map{"success": true})
}

func DisconnectInstance(c *fiber.Ctx) error {
	name := c.Params("name")
	if name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Instance name required"})
	}

	evolutionService.DisconnectInstance(name)

	if database.DB != nil {
		database.DB.Model(&models.WhatsAppInstance{}).
			Where("instance_name = ?", name).
			Updates(map[string]interface{}{
				"status":     models.InstanceStatusDisconnected,
				"updated_at": time.Now(),
			})
	}

	return c.JSON(fiber.Map{"success": true})
}

func GetInstanceStatus(c *fiber.Ctx) error {
	name := c.Params("name")
	if name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Instance name required"})
	}

	status, err := evolutionService.GetInstanceStatus(name)
	if err != nil {
		if database.DB != nil {
			var instance models.WhatsAppInstance
			if dbErr := database.DB.Where("instance_name = ?", name).First(&instance).Error; dbErr == nil {
				return c.JSON(fiber.Map{"status": instance.Status})
			}
		}
		return c.JSON(fiber.Map{"status": "DISCONNECTED"})
	}

	if database.DB != nil {
		database.DB.Model(&models.WhatsAppInstance{}).
			Where("instance_name = ?", name).
			Updates(map[string]interface{}{
				"status":     status,
				"updated_at": time.Now(),
			})
	}

	return c.JSON(fiber.Map{"status": status})
}
