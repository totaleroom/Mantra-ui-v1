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
		UserID: user.ID,
		Email:  user.Email,
		Role:   string(user.Role),
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
			"id":        user.ID,
			"email":     user.Email,
			"role":      user.Role,
			"createdAt": user.CreatedAt,
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

	return c.JSON(fiber.Map{
		"id":    userID,
		"email": email,
		"role":  role,
	})
}

func Register(c *fiber.Ctx) error {
	type RegisterRequest struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Role     string `json:"role"`
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

	user := models.User{
		Email:        req.Email,
		PasswordHash: string(hash),
		Role:         role,
	}

	if err := database.DB.Create(&user).Error; err != nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"error": "Email already exists",
			"code":  "CONFLICT",
		})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"id":        user.ID,
		"email":     user.Email,
		"role":      user.Role,
		"createdAt": user.CreatedAt,
	})
}
