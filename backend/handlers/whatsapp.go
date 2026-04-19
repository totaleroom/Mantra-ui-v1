package handlers

import (
	"log"
	"mantra-backend/config"
	"mantra-backend/database"
	"mantra-backend/models"
	"mantra-backend/services"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
)

var evolutionService = services.NewEvolutionService()
var instanceNameRegex = regexp.MustCompile(`^[a-z0-9-]+$`)

func GetWhatsAppInstances(c *fiber.Ctx) error {
	if database.DB == nil {
		return c.JSON([]interface{}{})
	}
	q, err := ScopedDB(c, database.DB.Model(&models.WhatsAppInstance{}), "client_id")
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "tenant scope missing", "code": "FORBIDDEN"})
	}
	var instances []models.WhatsAppInstance
	if err := q.Find(&instances).Error; err != nil {
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

	scope, scopeErr := EffectiveTenantScope(c)
	if scopeErr != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "tenant scope missing", "code": "FORBIDDEN"})
	}

	var instance models.WhatsAppInstance
	if err := database.DB.First(&instance, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Instance not found", "code": "NOT_FOUND"})
	}
	if scope != nil && instance.ClientID != *scope {
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

	// A tenant-scoped caller may only create instances under its OWN
	// clientId. SUPER_ADMIN may target any tenant (onboarding flow).
	scope, scopeErr := EffectiveTenantScope(c)
	if scopeErr != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "tenant scope missing", "code": "FORBIDDEN"})
	}
	if scope != nil && req.ClientID != *scope {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "cannot create instance under another tenant", "code": "FORBIDDEN_TENANT"})
	}

	webhookURL := ""
	if req.WebhookURL != nil {
		webhookURL = *req.WebhookURL
	}

	// Prefer our own backend as the webhook target so incoming messages
	// actually reach the orchestrator. If PUBLIC_BACKEND_URL isn't set
	// (dev without tunnel), fall back to the operator-supplied URL.
	effectiveWebhook := webhookURL
	if config.C != nil && config.C.PublicBackendURL != "" {
		effectiveWebhook = strings.TrimRight(config.C.PublicBackendURL, "/") +
			"/api/webhooks/evolution"
	}

	evoInstance, err := evolutionService.CreateInstance(req.InstanceName, effectiveWebhook)

	instance := models.WhatsAppInstance{
		ClientID:     req.ClientID,
		InstanceName: req.InstanceName,
		WebhookURL:   &effectiveWebhook,
		Status:       models.InstanceStatusConnecting,
		UpdatedAt:    time.Now(),
	}

	if err == nil && evoInstance != nil {
		apiKey := evoInstance.APIKey
		instance.InstanceAPIKey = &apiKey

		// Explicitly (re)configure the webhook in case Evolution's
		// /instance/create endpoint ignored the nested field on this version.
		if effectiveWebhook != "" {
			if whErr := evolutionService.SetWebhook(req.InstanceName, effectiveWebhook); whErr != nil {
				log.Printf("[WhatsApp] webhook registration failed for %s: %v", req.InstanceName, whErr)
			}
		}
	}

	if err != nil {
		log.Printf("[WhatsApp] Evolution CreateInstance failed: %v", err)
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

	scope, scopeErr := EffectiveTenantScope(c)
	if scopeErr != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "tenant scope missing", "code": "FORBIDDEN"})
	}

	var instance models.WhatsAppInstance
	if err := database.DB.First(&instance, id).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Instance not found"})
	}
	if scope != nil && instance.ClientID != *scope {
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

	if err := VerifyInstanceOwnership(c, name); err != nil {
		return err
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

// VerifyInstanceOwnership returns a ready-to-send 404 if the caller is not
// allowed to address the named WhatsApp instance. SUPER_ADMIN passes
// transparently. Used by routes that key off :name rather than :id (and
// therefore can't use RequireTenantAccess). Exported so the routes
// package can gate the QR WebSocket upgrade on ownership too.
func VerifyInstanceOwnership(c *fiber.Ctx, name string) error {
	if database.DB == nil {
		return nil
	}
	scope, scopeErr := EffectiveTenantScope(c)
	if scopeErr != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "tenant scope missing", "code": "FORBIDDEN"})
	}
	if scope == nil {
		return nil
	}
	var instance models.WhatsAppInstance
	if err := database.DB.Where("instance_name = ?", name).First(&instance).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Instance not found", "code": "NOT_FOUND"})
	}
	if instance.ClientID != *scope {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Instance not found", "code": "NOT_FOUND"})
	}
	return nil
}

// SendWhatsAppMessage lets an authenticated dashboard operator send a manual
// outbound message from an instance. Body: { "to": "628...", "text": "..." }.
func SendWhatsAppMessage(c *fiber.Ctx) error {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid ID"})
	}

	type SendReq struct {
		To   string `json:"to"`
		Text string `json:"text"`
	}
	var req SendReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid body"})
	}
	// Normalize: strip non-digits from number (user may paste "+62 812-3456-7890")
	req.To = stripNonDigits(req.To)
	if len(req.To) < 8 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid phone number",
			"code":  "VALIDATION_ERROR",
		})
	}
	if len(req.Text) == 0 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "text cannot be empty",
			"code":  "VALIDATION_ERROR",
		})
	}
	if len(req.Text) > 4000 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "text too long (max 4000 chars)",
			"code":  "VALIDATION_ERROR",
		})
	}

	// Verify the caller owns the instance referenced by :id.
	if database.DB != nil {
		scope, scopeErr := EffectiveTenantScope(c)
		if scopeErr != nil {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "tenant scope missing", "code": "FORBIDDEN"})
		}
		if scope != nil {
			var instance models.WhatsAppInstance
			if err := database.DB.First(&instance, id).Error; err != nil || instance.ClientID != *scope {
				return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Instance not found", "code": "NOT_FOUND"})
			}
		}
	}

	msg, err := Orchestrator.SendManual(uint(id), req.To, req.Text)
	if err != nil {
		return c.Status(fiber.StatusBadGateway).JSON(fiber.Map{
			"error": err.Error(),
			"code":  "SEND_FAILED",
		})
	}
	return c.Status(fiber.StatusCreated).JSON(msg)
}

func stripNonDigits(s string) string {
	out := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		if s[i] >= '0' && s[i] <= '9' {
			out = append(out, s[i])
		}
	}
	return string(out)
}

func GetInstanceStatus(c *fiber.Ctx) error {
	name := c.Params("name")
	if name == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Instance name required"})
	}

	if err := VerifyInstanceOwnership(c, name); err != nil {
		return err
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
