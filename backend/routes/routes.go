package routes

import (
	"mantra-backend/handlers"
	"mantra-backend/middleware"
	ws "mantra-backend/ws"
	"time"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
)

func Setup(app *fiber.App) {
	// Note: the real `/health` is registered in main.go with real DB+Redis probes.
	// This fallback is kept only in case Setup is called standalone in tests.

	// Per-IP rate limiter on authentication endpoints to slow down credential stuffing.
	// 10 requests per minute per IP is generous for humans and painful for bots.
	authLimiter := limiter.New(limiter.Config{
		Max:        10,
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"error": "Too many requests. Please try again later.",
				"code":  "RATE_LIMITED",
			})
		},
	})

	auth := app.Group("/api/auth")
	auth.Post("/login", authLimiter, handlers.Login)
	auth.Post("/register", authLimiter, handlers.Register)
	auth.Post("/logout", middleware.JWTProtected(), handlers.Logout)
	auth.Get("/me", middleware.JWTProtected(), handlers.Me)

	api := app.Group("/api", middleware.JWTProtected())

	providers := api.Group("/ai-providers")
	providers.Get("/models", handlers.GetAllModels)
	providers.Get("/", handlers.GetAIProviders)
	providers.Get("/:id/models", handlers.GetProviderModels)
	providers.Get("/:id", handlers.GetAIProvider)
	providers.Post("/", handlers.CreateAIProvider)
	providers.Put("/priorities", handlers.UpdateProviderPriorities)
	providers.Patch("/:id", handlers.UpdateAIProvider)
	providers.Delete("/:id", handlers.DeleteAIProvider)
	providers.Post("/:id/test", handlers.TestAIProvider)

	whatsapp := api.Group("/whatsapp/instances")
	whatsapp.Get("/", handlers.GetWhatsAppInstances)
	whatsapp.Post("/", handlers.CreateWhatsAppInstance)
	whatsapp.Get("/:id", handlers.GetWhatsAppInstance)
	whatsapp.Delete("/:id", handlers.DeleteWhatsAppInstance)
	whatsapp.Post("/:name/disconnect", handlers.DisconnectInstance)
	whatsapp.Get("/:name/status", handlers.GetInstanceStatus)

	inbox := api.Group("/inbox")
	inbox.Get("/messages", handlers.GetInboxMessages)
	inbox.Get("/stats", handlers.GetInboxStats)

	clients := api.Group("/clients")
	clients.Get("/", handlers.GetClients)
	clients.Post("/", handlers.CreateClient)
	clients.Get("/:id", handlers.GetClient)
	clients.Patch("/:id", handlers.UpdateClient)
	clients.Delete("/:id", handlers.DeleteClient)
	clients.Get("/:id/ai-config", handlers.GetClientAIConfig)
	clients.Put("/:id/ai-config", handlers.UpdateClientAIConfig)

	system := api.Group("/system")
	system.Get("/health", handlers.GetSystemHealth)
	system.Post("/diagnose", handlers.RunDiagnosis)

	app.Use("/api/inbox/live", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})
	app.Get("/api/inbox/live", websocket.New(ws.InboxLiveWebSocket))

	app.Use("/api/whatsapp/instances/:name/qr", func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})
	app.Get("/api/whatsapp/instances/:name/qr", websocket.New(ws.QRCodeWebSocket))
}
