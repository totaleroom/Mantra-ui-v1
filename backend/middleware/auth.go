package middleware

import (
	"mantra-backend/config"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID uint   `json:"userId"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	// ClientID is nil for SUPER_ADMIN (cross-tenant operator) and
	// a concrete tenant id for CLIENT_ADMIN / STAFF. Tenant-scoped
	// handlers gate access using this value.
	ClientID           *uint `json:"clientId,omitempty"`
	MustChangePassword bool  `json:"mcp,omitempty"`
	jwt.RegisteredClaims
}

// SessionCookie is the shared cookie name used by handlers.Login + the
// Next.js server action in app/login/actions.ts. Changing it requires
// updating both sides in lockstep.
const SessionCookie = "mantra_session"

func JWTProtected() fiber.Handler {
	return func(c *fiber.Ctx) error {
		tokenStr := extractToken(c)

		if tokenStr == "" {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Missing authentication token",
				"code":  "UNAUTHORIZED",
			})
		}

		claims := &Claims{}
		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fiber.ErrUnauthorized
			}
			return []byte(config.C.JWTSecret), nil
		})

		if err != nil || !token.Valid {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"error": "Invalid or expired token",
				"code":  "TOKEN_INVALID",
			})
		}

		c.Locals("userID", claims.UserID)
		c.Locals("email", claims.Email)
		c.Locals("role", claims.Role)
		c.Locals("clientID", claims.ClientID)
		c.Locals("mustChangePassword", claims.MustChangePassword)
		return c.Next()
	}
}

// BlockUntilPasswordChanged rejects any tenant-scoped API access while the
// caller still carries the MustChangePassword flag. The rotation endpoint
// and logout MUST be allowlisted so the user can actually finish the flow.
//
// Register this AFTER JWTProtected and BEFORE the allowlisted groups:
//   api := app.Group("/api", JWTProtected())
//   api.Post("/auth/change-password", handlers.ChangePassword)  // allowlisted
//   api.Post("/auth/logout", handlers.Logout)                   // allowlisted
//   api.Use(BlockUntilPasswordChanged())
//   ... other routes ...
func BlockUntilPasswordChanged() fiber.Handler {
	return func(c *fiber.Ctx) error {
		must, _ := c.Locals("mustChangePassword").(bool)
		if !must {
			return c.Next()
		}
		return c.Status(fiber.StatusPreconditionRequired).JSON(fiber.Map{
			"error": "you must change your password before accessing any other resource",
			"code":  "PASSWORD_CHANGE_REQUIRED",
		})
	}
}

// RequireTenantAccess guards a tenant-scoped endpoint. It must be chained
// AFTER JWTProtected. The path param name (e.g. "id") is compared against
// the authenticated user's ClientID claim. SUPER_ADMIN bypasses the check.
//
// Returns 403 if the user is trying to touch a tenant they don't own.
// Returns 400 if the param is missing / not a positive integer — this
// is a programming error upstream, not an auth failure, but surfacing
// it with a clear code helps tenant pentesters understand the boundary.
func RequireTenantAccess(paramName string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		role, _ := c.Locals("role").(string)

		// SUPER_ADMIN can traverse any tenant (billing, audit, support).
		if role == "SUPER_ADMIN" {
			return c.Next()
		}

		pathIDStr := c.Params(paramName)
		if pathIDStr == "" {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "missing path parameter",
				"code":  "BAD_REQUEST",
			})
		}
		var pathID uint64
		for i := 0; i < len(pathIDStr); i++ {
			ch := pathIDStr[i]
			if ch < '0' || ch > '9' {
				return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
					"error": "invalid tenant id",
					"code":  "BAD_REQUEST",
				})
			}
			pathID = pathID*10 + uint64(ch-'0')
		}
		if pathID == 0 {
			return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"error": "invalid tenant id",
				"code":  "BAD_REQUEST",
			})
		}

		claimClientID, _ := c.Locals("clientID").(*uint)
		if claimClientID == nil || uint64(*claimClientID) != pathID {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "you do not have access to this tenant",
				"code":  "FORBIDDEN_TENANT",
			})
		}
		return c.Next()
	}
}

// extractToken resolves a JWT from (in order): Authorization: Bearer header,
// `mantra_session` cookie (set by server action / backend login), or
// `?token=` query param (WebSocket fallback since browsers can't set
// headers on ws://). The cookie path makes the Go backend usable from a
// same-origin browser without forcing the frontend to echo the cookie
// into a header — which it cannot do for HttpOnly cookies anyway.
func extractToken(c *fiber.Ctx) string {
	if authHeader := c.Get("Authorization"); strings.HasPrefix(authHeader, "Bearer ") {
		return strings.TrimPrefix(authHeader, "Bearer ")
	}
	if cookie := c.Cookies(SessionCookie); cookie != "" {
		return cookie
	}
	// Query-string token is a last-resort WebSocket fallback. It leaks
	// into access logs, so the frontend should prefer cookie auth.
	return c.Query("token")
}

// ParseToken validates a JWT string and returns the decoded Claims.
// Exposed so the WebSocket upgrade handler (which lives outside the
// standard middleware chain) can share the same validation logic.
func ParseToken(tokenStr string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fiber.ErrUnauthorized
		}
		return []byte(config.C.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, fiber.ErrUnauthorized
	}
	return claims, nil
}

// ExtractToken is the public wrapper around extractToken for handlers
// outside the JWT middleware chain (e.g. the WebSocket upgrade).
func ExtractToken(c *fiber.Ctx) string { return extractToken(c) }

func RequireRole(roles ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		role, ok := c.Locals("role").(string)
		if !ok {
			return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
				"error": "Forbidden",
				"code":  "FORBIDDEN",
			})
		}
		for _, r := range roles {
			if r == role {
				return c.Next()
			}
		}
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "Insufficient permissions",
			"code":  "FORBIDDEN",
		})
	}
}
