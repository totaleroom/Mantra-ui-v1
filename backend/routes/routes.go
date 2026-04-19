package routes

import (
	"mantra-backend/handlers"
	"mantra-backend/middleware"
	"mantra-backend/models"
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
	// Register now requires SUPER_ADMIN auth internally (see handlers.Register).
	// Keep the JWT middleware so unauthenticated callers bounce off before
	// hitting the DB.
	auth.Post("/register", middleware.JWTProtected(), handlers.Register)
	auth.Post("/logout", middleware.JWTProtected(), handlers.Logout)
	auth.Get("/me", middleware.JWTProtected(), handlers.Me)
	// Change-password must stay callable even when the user's
	// must_change_password flag is still TRUE (it's how they clear it).
	// So it's registered OUTSIDE the `api` group, guarded only by JWT.
	auth.Post("/change-password", middleware.JWTProtected(), handlers.ChangePassword)

	// Everything below is behind JWT AND the password-rotation gate.
	// Users whose must_change_password flag is still set receive 428
	// (Precondition Required) until they call /api/auth/change-password.
	api := app.Group("/api", middleware.JWTProtected(), middleware.BlockUntilPasswordChanged())

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
	whatsapp.Post("/:id/send", handlers.SendWhatsAppMessage)
	whatsapp.Post("/:name/disconnect", handlers.DisconnectInstance)
	whatsapp.Get("/:name/status", handlers.GetInstanceStatus)

	// Evolution webhook receiver — NO JWT, authenticated via X-Webhook-Secret header.
	// Own rate limiter: generous for real traffic, tight against unauth'd probing.
	webhookLimiter := limiter.New(limiter.Config{
		Max:        300,
		Expiration: 1 * time.Minute,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
	})
	app.Post("/api/webhooks/evolution", webhookLimiter, handlers.EvolutionWebhook)

	inbox := api.Group("/inbox")
	inbox.Get("/messages", handlers.GetInboxMessages)
	inbox.Get("/stats", handlers.GetInboxStats)

	// Tenant CRUD — creating / listing / deleting whole tenants is
	// SUPER_ADMIN only. Tenant-scoped reads/writes (/:id) are guarded
	// by RequireTenantAccess ("id") which lets SUPER_ADMIN pass too.
	superAdminOnly := middleware.RequireRole(string(models.UserRoleSuperAdmin))
	clients := api.Group("/clients")
	clients.Get("/", superAdminOnly, handlers.GetClients)
	clients.Post("/", superAdminOnly, handlers.CreateClient)
	clients.Delete("/:id", superAdminOnly, handlers.DeleteClient)

	// Per-tenant routes — isolation enforced by RequireTenantAccess.
	tenantScoped := clients.Group("/:id", middleware.RequireTenantAccess("id"))
	tenantScoped.Get("/", handlers.GetClient)
	tenantScoped.Patch("/", handlers.UpdateClient)
	tenantScoped.Get("/ai-config", handlers.GetClientAIConfig)
	tenantScoped.Put("/ai-config", handlers.UpdateClientAIConfig)

	// ─── Knowledge base (Phase 2 — RAG foundation) ─────────────────────
	// All endpoints below are tenant-scoped; RequireTenantAccess ensures
	// a STAFF of tenant A cannot read / write tenant B's knowledge.
	tenantScoped.Get("/knowledge/stats", handlers.GetKnowledgeStats)
	tenantScoped.Post("/knowledge/chunks", handlers.UploadKnowledgeChunks)
	tenantScoped.Get("/knowledge/chunks", handlers.ListKnowledgeChunks)
	tenantScoped.Delete("/knowledge/chunks/:chunkId", handlers.DeleteKnowledgeChunk)
	tenantScoped.Post("/knowledge/faqs", handlers.CreateFAQ)
	tenantScoped.Get("/knowledge/faqs", handlers.ListFAQs)
	tenantScoped.Patch("/knowledge/faqs/:faqId", handlers.UpdateFAQ)
	tenantScoped.Delete("/knowledge/faqs/:faqId", handlers.DeleteFAQ)

	// ─── Tool calling (Phase 4 — AI function calling) ──────────────────
	// Per-tenant tool definitions the AI can invoke during a conversation.
	// Supports builtin (compiled Go handlers) and webhook (tenant URL)
	// handler types. Execution is driven by orchestrator.runReplyLoop.
	tenantScoped.Post("/tools", handlers.CreateTool)
	tenantScoped.Get("/tools", handlers.ListTools)
	tenantScoped.Patch("/tools/:toolId", handlers.UpdateTool)
	tenantScoped.Delete("/tools/:toolId", handlers.DeleteTool)

	system := api.Group("/system", superAdminOnly)
	system.Get("/health", handlers.GetSystemHealth)
	system.Post("/diagnose", handlers.RunDiagnosis)
	// Comprehensive "blackbox" health report. Consumed by both Hermes
	// agent (machine, JSON) and the Diagnosis Center page (human, UI).
	// Every failing check carries a remediation hint + doc link.
	// Returns 503 when overall==fail so Coolify / uptime monitors can
	// alert; returns 200 when overall==warn|ok.
	system.Get("/preflight", handlers.Preflight)

	// WebSocket upgrade middleware chain:
	//   1. Require WebSocket Upgrade header (else 426).
	//   2. JWTProtected — populates c.Locals with role/clientID so the
	//      ws handler can read them via conn.Locals(...).
	//   3. BlockUntilPasswordChanged — same gate as other /api/* routes.
	//   4. (Resource-specific ownership checks for /qr.)
	wsUpgrade := func(c *fiber.Ctx) error {
		if websocket.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	}

	app.Get(
		"/api/inbox/live",
		wsUpgrade,
		middleware.JWTProtected(),
		middleware.BlockUntilPasswordChanged(),
		websocket.New(ws.InboxLiveWebSocket),
	)

	app.Get(
		"/api/whatsapp/instances/:name/qr",
		wsUpgrade,
		middleware.JWTProtected(),
		middleware.BlockUntilPasswordChanged(),
		// Tenant ownership is enforced per-:name (not per-:id), so we
		// use the handlers.VerifyInstanceOwnership shortcut here.
		func(c *fiber.Ctx) error {
			if err := handlers.VerifyInstanceOwnership(c, c.Params("name")); err != nil {
				return err
			}
			return c.Next()
		},
		websocket.New(ws.QRCodeWebSocket),
	)
}
