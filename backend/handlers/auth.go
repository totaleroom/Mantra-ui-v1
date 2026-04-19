package handlers

import (
	"mantra-backend/config"
	"mantra-backend/database"
	"mantra-backend/middleware"
	"mantra-backend/models"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// Authentication tunables — change here and nowhere else.
const (
	// bcryptCost 12 is the current OWASP recommendation for passwords
	// (takes ~250ms on a modern CPU — painful for brute force, fine for a single login).
	bcryptCost = 12

	// sessionDuration balances security vs UX: long enough to cover a working
	// session, short enough to limit exposure if a cookie leaks.
	sessionDuration = 8 * time.Hour
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
			"code":  "BAD_REQUEST",
		})
	}

	if req.Email == "" || req.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Email and password are required",
			"code":  "VALIDATION_ERROR",
		})
	}

	if database.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": "Database not connected",
			"code":  "SERVICE_UNAVAILABLE",
		})
	}

	var user models.User
	if err := database.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Invalid credentials",
			"code":  "UNAUTHORIZED",
		})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "Invalid credentials",
			"code":  "UNAUTHORIZED",
		})
	}

	claims := &middleware.Claims{
		UserID:             user.ID,
		Email:              user.Email,
		Role:               string(user.Role),
		ClientID:           user.ClientID,
		MustChangePassword: user.MustChangePassword,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(sessionDuration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := token.SignedString([]byte(config.C.JWTSecret))
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to generate token",
			"code":  "INTERNAL_ERROR",
		})
	}

	c.Cookie(&fiber.Cookie{
		Name:     "mantra_session",
		Value:    tokenStr,
		Path:     "/",
		HTTPOnly: true,
		Secure:   config.C.IsProd(),
		SameSite: "Lax",
		MaxAge:   int(sessionDuration.Seconds()),
	})

	return c.JSON(fiber.Map{
		"token": tokenStr,
		"user": fiber.Map{
			"id":                 user.ID,
			"email":              user.Email,
			"role":               user.Role,
			"clientId":           user.ClientID,
			"mustChangePassword": user.MustChangePassword,
			"createdAt":          user.CreatedAt,
		},
	})
}

func Logout(c *fiber.Ctx) error {
	// ClearCookie alone leaves Path/Secure mismatched in some browsers,
	// so we overwrite with an expired cookie using the same attributes.
	c.Cookie(&fiber.Cookie{
		Name:     "mantra_session",
		Value:    "",
		Path:     "/",
		HTTPOnly: true,
		Secure:   config.C.IsProd(),
		SameSite: "Lax",
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	})
	return c.JSON(fiber.Map{"success": true})
}

func Me(c *fiber.Ctx) error {
	userID, _ := c.Locals("userID").(uint)
	email, _ := c.Locals("email").(string)
	role, _ := c.Locals("role").(string)
	clientID, _ := c.Locals("clientID").(*uint)
	mcp, _ := c.Locals("mustChangePassword").(bool)

	return c.JSON(fiber.Map{
		"id":                 userID,
		"email":              email,
		"role":               role,
		"clientId":           clientID,
		"mustChangePassword": mcp,
	})
}

func Register(c *fiber.Ctx) error {
	type RegisterRequest struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Role     string `json:"role"`
		ClientID *uint  `json:"clientId"`
	}

	// Only authenticated SUPER_ADMINs may create new accounts via this
	// endpoint; the anonymous self-signup path was removed because it let
	// anyone mint a SUPER_ADMIN by passing role="SUPER_ADMIN".
	callerRole, _ := c.Locals("role").(string)
	if callerRole != string(models.UserRoleSuperAdmin) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{
			"error": "only SUPER_ADMIN can create new accounts",
			"code":  "FORBIDDEN",
		})
	}

	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
			"code":  "BAD_REQUEST",
		})
	}

	if req.Email == "" || req.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Email and password are required",
			"code":  "VALIDATION_ERROR",
		})
	}

	if database.DB == nil {
		return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{
			"error": "Database not connected",
			"code":  "SERVICE_UNAVAILABLE",
		})
	}

	if len(req.Password) < 8 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Password must be at least 8 characters",
			"code":  "WEAK_PASSWORD",
		})
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcryptCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to hash password",
			"code":  "INTERNAL_ERROR",
		})
	}

	role := models.UserRoleClientAdmin
	if req.Role == string(models.UserRoleSuperAdmin) {
		role = models.UserRoleSuperAdmin
	} else if req.Role == string(models.UserRoleStaff) {
		role = models.UserRoleStaff
	}

	// SUPER_ADMIN is tenant-agnostic; tenant-scoped roles require a clientId.
	if role != models.UserRoleSuperAdmin && req.ClientID == nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "clientId is required for CLIENT_ADMIN / STAFF accounts",
			"code":  "VALIDATION_ERROR",
		})
	}

	user := models.User{
		Email:              req.Email,
		PasswordHash:       string(hash),
		Role:               role,
		ClientID:           req.ClientID,
		MustChangePassword: true, // every created account must rotate the bootstrap password
	}

	if err := database.DB.Create(&user).Error; err != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "Email already exists",
			"code":  "CONFLICT",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"id":                 user.ID,
		"email":              user.Email,
		"role":               user.Role,
		"clientId":           user.ClientID,
		"mustChangePassword": user.MustChangePassword,
		"createdAt":          user.CreatedAt,
	})
}

// ChangePassword is the self-service endpoint for any authenticated user
// to rotate their password. It MUST stay reachable even when the caller's
// `must_change_password` flag is set — that is the whole point: we force
// seeded / bootstrapped accounts through this before they can use any
// other API surface. Clearing the flag is the only side effect beyond
// the hash update.
func ChangePassword(c *fiber.Ctx) error {
	type changePasswordRequest struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}

	var req changePasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "invalid body",
			"code":  "BAD_REQUEST",
		})
	}
	if len(req.NewPassword) < 8 {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "new password must be at least 8 characters",
			"code":  "WEAK_PASSWORD",
		})
	}
	if req.NewPassword == req.CurrentPassword {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "new password must differ from current",
			"code":  "SAME_PASSWORD",
		})
	}

	userID, _ := c.Locals("userID").(uint)
	if userID == 0 {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "unauthorized",
			"code":  "UNAUTHORIZED",
		})
	}

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "user not found",
			"code":  "UNAUTHORIZED",
		})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"error": "current password is incorrect",
			"code":  "UNAUTHORIZED",
		})
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcryptCost)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "hash failed",
			"code":  "INTERNAL_ERROR",
		})
	}

	if err := database.DB.Model(&user).Updates(map[string]interface{}{
		"password":             string(hash),
		"must_change_password": false,
	}).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "could not update password",
			"code":  "INTERNAL_ERROR",
		})
	}

	// Re-issue the JWT with MustChangePassword=false so the very next
	// request from this browser succeeds without a logout/login round-trip.
	// Old cookie is overwritten atomically by the Set-Cookie response header.
	user.MustChangePassword = false
	newClaims := &middleware.Claims{
		UserID:             user.ID,
		Email:              user.Email,
		Role:               string(user.Role),
		ClientID:           user.ClientID,
		MustChangePassword: false,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(sessionDuration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}
	newToken := jwt.NewWithClaims(jwt.SigningMethodHS256, newClaims)
	newTokenStr, signErr := newToken.SignedString([]byte(config.C.JWTSecret))
	if signErr != nil {
		// The rotation worked at the DB level, so don't fail the whole
		// request — client will just need to re-login to pick up clean
		// claims. Log so ops can notice if this starts happening a lot.
		return c.JSON(fiber.Map{
			"success":     true,
			"tokenReused": true,
		})
	}

	c.Cookie(&fiber.Cookie{
		Name:     middleware.SessionCookie,
		Value:    newTokenStr,
		Path:     "/",
		HTTPOnly: true,
		Secure:   config.C.IsProd(),
		SameSite: "Lax",
		MaxAge:   int(sessionDuration.Seconds()),
	})

	return c.JSON(fiber.Map{
		"success": true,
		"token":   newTokenStr,
	})
}
