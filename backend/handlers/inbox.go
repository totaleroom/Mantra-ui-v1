package handlers

import (
	"mantra-backend/database"
	"mantra-backend/models"
	"strconv"

	"github.com/gofiber/fiber/v2"
)

func GetInboxMessages(c *fiber.Ctx) error {
	if database.DB == nil {
		return c.JSON([]interface{}{})
	}

	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	if limit > 100 {
		limit = 100
	}
	if limit < 1 {
		limit = 50
	}

	clientIDStr := c.Query("clientId")
	direction := c.Query("direction")
	search := c.Query("search")

	query := database.DB.Model(&models.InboxMessage{}).
		Preload("Client").
		Order("timestamp desc").
		Limit(limit).
		Offset(offset)

	if clientIDStr != "" {
		if cid, err := strconv.ParseUint(clientIDStr, 10, 64); err == nil {
			query = query.Where("inbox_messages.client_id = ?", cid)
		}
	}
	if direction == "inbound" || direction == "outbound" {
		query = query.Where("direction = ?", direction)
	}
	if search != "" {
		query = query.Where("message ILIKE ?", "%"+search+"%")
	}

	var messages []models.InboxMessage
	if err := query.Find(&messages).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch messages",
			"code":  "INTERNAL_ERROR",
		})
	}

	for i := range messages {
		if messages[i].Client != nil {
			messages[i].ClientName = messages[i].Client.Name
		}
	}

	return c.JSON(messages)
}

func GetInboxStats(c *fiber.Ctx) error {
	if database.DB == nil {
		return c.JSON(fiber.Map{
			"total":       0,
			"inbound":     0,
			"outbound":    0,
			"aiProcessed": 0,
		})
	}

	var total int64
	var inbound int64
	var outbound int64
	var aiProcessed int64

	database.DB.Model(&models.InboxMessage{}).Count(&total)
	database.DB.Model(&models.InboxMessage{}).Where("direction = ?", "inbound").Count(&inbound)
	database.DB.Model(&models.InboxMessage{}).Where("direction = ?", "outbound").Count(&outbound)
	database.DB.Model(&models.InboxMessage{}).Where("model_used IS NOT NULL AND model_used != ''").Count(&aiProcessed)

	return c.JSON(fiber.Map{
		"total":       total,
		"inbound":     inbound,
		"outbound":    outbound,
		"aiProcessed": aiProcessed,
	})
}
