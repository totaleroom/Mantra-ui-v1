package main

import (
	"context"
	"log"
	"mantra-backend/config"
	"mantra-backend/database"
	"mantra-backend/routes"
	ws "mantra-backend/ws"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("[Config] No .env file found, using environment variables")
	}

	config.Load()

	database.ConnectPostgres()
	database.ConnectRedis()

	go ws.InboxHubInstance.Run()

	app := fiber.New(fiber.Config{
		AppName:      "Mantra AI Backend",
		ErrorHandler: errorHandler,
	})

	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format: "[${time}] ${status} - ${method} ${path} (${latency})\n",
	}))

	corsOrigins := strings.Join(config.C.CORSOrigins, ",")
	app.Use(cors.New(cors.Config{
		AllowOrigins:     corsOrigins,
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization",
		AllowCredentials: true,
	}))

	app.Get("/health", healthCheck)

	routes.Setup(app)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		port := config.C.Port
		log.Printf("[Server] Mantra AI Backend starting on :%s", port)
		if err := app.Listen("0.0.0.0:" + port); err != nil {
			log.Fatalf("[Server] Failed to start: %v", err)
		}
	}()

	<-quit
	log.Println("[Server] Shutting down gracefully...")
	if err := app.Shutdown(); err != nil {
		log.Printf("[Server] Shutdown error: %v", err)
	}

	if database.Redis != nil {
		database.Redis.Close()
	}
	log.Println("[Server] Shutdown complete")
}

func healthCheck(c *fiber.Ctx) error {
	dbOK := false
	redisOK := false
	dbLatency := 0
	redisLatency := 0

	if database.DB != nil {
		if sqlDB, err := database.DB.DB(); err == nil {
			if err := sqlDB.Ping(); err == nil {
				dbOK = true
			}
		}
	}

	if database.Redis != nil {
		ctx := context.Background()
		if err := database.Redis.Ping(ctx).Err(); err == nil {
			redisOK = true
		}
	}

	body := fiber.Map{
		"service": "mantra-backend",
		"db":      statusLabel(dbOK),
		"redis":   statusLabel(redisOK),
		"dbLatencyMs":    dbLatency,
		"redisLatencyMs": redisLatency,
	}

	if dbOK && redisOK {
		body["status"] = "ok"
		return c.Status(fiber.StatusOK).JSON(body)
	}

	body["status"] = "degraded"
	return c.Status(fiber.StatusServiceUnavailable).JSON(body)
}

func statusLabel(ok bool) string {
	if ok {
		return "connected"
	}
	return "unavailable"
}

func errorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	msg := "Internal Server Error"

	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
		msg = e.Message
	}

	return c.Status(code).JSON(fiber.Map{
		"error": msg,
		"code":  "ERROR",
	})
}
