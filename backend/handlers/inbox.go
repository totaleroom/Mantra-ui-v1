package handlers

import (
	"mantra-backend/database"
	"mantra-backend/models"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// scopedInboxQuery returns a base query pre-filtered to the caller's
// tenant (or unfiltered for SUPER_ADMIN). The `?clientId=` query param
// is ONLY honored for SUPER_ADMIN; every other role is pinned to their
// JWT.clientId so a STAFF of tenant A cannot peek into tenant B by
// guessing a clientId value.
func scopedInboxQuery(c *fiber.Ctx) (*gorm.DB, error) {
	role, _ := c.Locals("role").(string)
	claimClientID, _ := c.Locals("clientID").(*uint)

	query := database.DB.Model(&models.InboxMessage{})

	if role != string(models.UserRoleSuperAdmin) {
		if claimClientID == nil {
			return nil, fiber.ErrForbidden
		}
		query = query.Where("inbox_messages.client_id = ?", *claimClientID)
	} else if cidStr := c.Query("clientId"); cidStr != "" {
		if cid, err := strconv.ParseUint(cidStr, 10, 64); err == nil {
			query = query.Where("inbox_messages.client_id = ?", cid)
		}
	}
	return query, nil
}

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

	direction := c.Query("direction")
	search := c.Query("search")

	query, err := scopedInboxQuery(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "tenant scope missing",
			"code":  "FORBIDDEN",
		})
	}
	query = query.
		Preload("Client").
		Order("timestamp desc").
		Limit(limit).
		Offset(offset)

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

	// Build three base queries scoped identically so stats match messages.
	base, err := scopedInboxQuery(c)
	if err != nil {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "tenant scope missing",
			"code":  "FORBIDDEN",
		})
	}

	var total, inbound, outbound, aiProcessed int64
	base.Count(&total)
	// .Count() consumes the query; re-derive for each filter.
	if q, err := scopedInboxQuery(c); err == nil {
		q.Where("direction = ?", "inbound").Count(&inbound)
	}
	if q, err := scopedInboxQuery(c); err == nil {
		q.Where("direction = ?", "outbound").Count(&outbound)
	}
	if q, err := scopedInboxQuery(c); err == nil {
		q.Where("model_used IS NOT NULL AND model_used != ''").Count(&aiProcessed)
	}

	return c.JSON(fiber.Map{
		"total":       total,
		"inbound":     inbound,
		"outbound":    outbound,
		"aiProcessed": aiProcessed,
	})
}
