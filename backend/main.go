package main

import (
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

	routes.Setup(app)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		port := config.C.Port
		log.Printf("[Server] Mantra AI Backend starting on :%s", port)
		if err := app.Listen(":" + port); err != nil {
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
