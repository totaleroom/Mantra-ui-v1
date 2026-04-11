package routes

import (
	"mantra-backend/handlers"
	"mantra-backend/middleware"
	ws "mantra-backend/ws"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
)

func Setup(app *fiber.App) {
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "service": "mantra-backend"})
	})

	auth := app.Group("/api/auth")
	auth.Post("/login", handlers.Login)
	auth.Post("/register", handlers.Register)
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
