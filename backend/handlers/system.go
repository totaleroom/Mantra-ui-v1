package handlers

import (
	"context"
	"mantra-backend/config"
	"mantra-backend/database"
	"mantra-backend/models"
	"net/http"
	"time"

	"github.com/gofiber/fiber/v2"
)

func GetSystemHealth(c *fiber.Ctx) error {
	serviceList := []models.ServiceHealth{}

	pgStatus, pgLatency := checkPostgres()
	serviceList = append(serviceList, models.ServiceHealth{
		ID:          1,
		ServiceName: "PostgreSQL",
		Status:      pgStatus,
		Latency:     pgLatency,
		LastCheck:   time.Now(),
	})

	redisStatus, redisLatency := checkRedis()
	serviceList = append(serviceList, models.ServiceHealth{
		ID:          2,
		ServiceName: "Redis",
		Status:      redisStatus,
		Latency:     redisLatency,
		LastCheck:   time.Now(),
	})

	evoStatus, evoLatency := checkEvolutionAPI()
	serviceList = append(serviceList, models.ServiceHealth{
		ID:          3,
		ServiceName: "Evolution API",
		Status:      evoStatus,
		Latency:     evoLatency,
		LastCheck:   time.Now(),
	})

	overall := models.ServiceStatusHealthy
	for _, svc := range serviceList {
		if svc.Status == models.ServiceStatusUnhealthy {
			overall = models.ServiceStatusUnhealthy
			break
		} else if svc.Status == models.ServiceStatusDegraded && overall == models.ServiceStatusHealthy {
			overall = models.ServiceStatusDegraded
		}
	}

	if database.DB != nil {
		for _, svc := range serviceList {
			var diag models.SystemDiagnosis
			database.DB.Where("service_name = ?", svc.ServiceName).FirstOrInit(&diag)
			diag.ServiceName = svc.ServiceName
			diag.Status = svc.Status
			diag.Latency = svc.Latency
			diag.LastCheck = svc.LastCheck
			database.DB.Save(&diag)
		}
	}

	return c.JSON(fiber.Map{
		"services": serviceList,
		"overall":  overall,
	})
}

func RunDiagnosis(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"diagnosis": "System check complete. Review individual service statuses for details.",
		"recommendations": []fiber.Map{
			{
				"severity": "info",
				"action":   "Ensure DATABASE_URL, REDIS_URL, and EVOLUTION_API_URL environment variables are set",
				"command":  nil,
			},
			{
				"severity": "info",
				"action":   "Monitor Evolution API for WhatsApp QR code generation issues",
				"command":  nil,
			},
		},
	})
}

func checkPostgres() (models.ServiceStatus, int) {
	if database.DB == nil {
		return models.ServiceStatusUnhealthy, 0
	}
	sqlDB, err := database.DB.DB()
	if err != nil {
		return models.ServiceStatusUnhealthy, 0
	}
	start := time.Now()
	if err := sqlDB.Ping(); err != nil {
		return models.ServiceStatusUnhealthy, 0
	}
	latency := int(time.Since(start).Milliseconds())
	if latency > 200 {
		return models.ServiceStatusDegraded, latency
	}
	return models.ServiceStatusHealthy, latency
}

func checkRedis() (models.ServiceStatus, int) {
	if database.Redis == nil {
		return models.ServiceStatusUnhealthy, 0
	}
	ctx := context.Background()
	start := time.Now()
	if err := database.Redis.Ping(ctx).Err(); err != nil {
		return models.ServiceStatusUnhealthy, 0
	}
	latency := int(time.Since(start).Milliseconds())
	if latency > 100 {
		return models.ServiceStatusDegraded, latency
	}
	return models.ServiceStatusHealthy, latency
}

func checkEvolutionAPI() (models.ServiceStatus, int) {
	evoURL := config.C.EvolutionURL
	if evoURL == "" {
		evoURL = "http://localhost:8080"
	}

	client := &http.Client{Timeout: 5 * time.Second}
	start := time.Now()
	resp, err := client.Get(evoURL + "/")
	latency := int(time.Since(start).Milliseconds())

	if err != nil {
		return models.ServiceStatusUnhealthy, latency
	}
	defer resp.Body.Close()

	if latency > 1000 {
		return models.ServiceStatusDegraded, latency
	}
	return models.ServiceStatusHealthy, latency
}
