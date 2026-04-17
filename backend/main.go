package main

import (
	"context"
	"log"
	"mantra-backend/config"
	"mantra-backend/database"
	"mantra-backend/handlers"
	"mantra-backend/models"
	"mantra-backend/routes"
	ws "mantra-backend/ws"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/fiber/v2/middleware/requestid"
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

	// Wire orchestrator -> inbox WebSocket so every persisted message
	// (inbound AND outbound) streams live to dashboard subscribers.
	handlers.Orchestrator.OnMessagePersisted(func(msg *models.InboxMessage) {
		if msg == nil {
			return
		}
		ws.InboxHubInstance.BroadcastMessage(msg)
	})

	app := fiber.New(fiber.Config{
		AppName:               "Mantra AI Backend",
		ErrorHandler:          errorHandler,
		DisableStartupMessage: true,
		// Sensible request limits so a misbehaving client can't exhaust memory.
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  120 * time.Second,
		BodyLimit:    4 * 1024 * 1024, // 4 MB
	})

	app.Use(recover.New(recover.Config{EnableStackTrace: true}))
	app.Use(requestid.New(requestid.Config{
		Header:     "X-Request-ID",
		ContextKey: "requestid",
	}))
	// Structured access log (JSON-ish, one line per request) including latency + request id.
	app.Use(logger.New(logger.Config{
		Format:     `{"ts":"${time}","level":"info","msg":"http","rid":"${locals:requestid}","status":${status},"method":"${method}","path":"${path}","latency":"${latency}","ip":"${ip}","bytes":${bytesSent}}` + "\n",
		TimeFormat: time.RFC3339,
		TimeZone:   "UTC",
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
	const probeTimeout = 2 * time.Second

	dbOK, dbLatencyMs := probeDB(probeTimeout)
	redisOK, redisLatencyMs := probeRedis(probeTimeout)

	body := fiber.Map{
		"service":        "mantra-backend",
		"db":             statusLabel(dbOK),
		"redis":          statusLabel(redisOK),
		"dbLatencyMs":    dbLatencyMs,
		"redisLatencyMs": redisLatencyMs,
		"timestamp":      time.Now().UTC().Format(time.RFC3339),
	}

	if dbOK && redisOK {
		body["status"] = "ok"
		return c.Status(fiber.StatusOK).JSON(body)
	}

	body["status"] = "degraded"
	return c.Status(fiber.StatusServiceUnavailable).JSON(body)
}

func probeDB(timeout time.Duration) (bool, int64) {
	if database.DB == nil {
		return false, -1
	}
	sqlDB, err := database.DB.DB()
	if err != nil {
		return false, -1
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	start := time.Now()
	if err := sqlDB.PingContext(ctx); err != nil {
		return false, -1
	}
	return true, time.Since(start).Milliseconds()
}

func probeRedis(timeout time.Duration) (bool, int64) {
	if database.Redis == nil {
		return false, -1
	}
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	start := time.Now()
	if err := database.Redis.Ping(ctx).Err(); err != nil {
		return false, -1
	}
	return true, time.Since(start).Milliseconds()
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
