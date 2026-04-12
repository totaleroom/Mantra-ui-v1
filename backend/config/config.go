package config

import (
	"os"
	"strings"
)

type Config struct {
	Port        string
	DatabaseURL string
	RedisURL    string
	JWTSecret   string
	CORSOrigins []string
	FrontendURL string
	EvolutionURL string
	EvolutionKey string
	Env         string
}

var C *Config

func Load() {
	frontendURL := getEnv("FRONTEND_URL", "")

	var corsOrigins []string

	if frontendURL != "" {
		corsOrigins = append(corsOrigins, frontendURL)
		if strings.HasSuffix(frontendURL, ".vercel.app") {
			corsOrigins = append(corsOrigins, "https://*.vercel.app")
		}
	}

	if extra := getEnv("CORS_ORIGINS", ""); extra != "" {
		for _, o := range strings.Split(extra, ",") {
			if trimmed := strings.TrimSpace(o); trimmed != "" {
				corsOrigins = append(corsOrigins, trimmed)
			}
		}
	}

	if len(corsOrigins) == 0 {
		corsOrigins = []string{
			"http://localhost:3000",
			"http://localhost:5000",
		}
	}

	C = &Config{
		Port:         getEnv("PORT", "3001"),
		DatabaseURL:  getEnv("DATABASE_URL", ""),
		RedisURL:     getEnv("REDIS_URL", "redis://localhost:6379"),
		JWTSecret:    getEnv("JWT_SECRET", "change-me-in-production-please"),
		CORSOrigins:  corsOrigins,
		FrontendURL:  frontendURL,
		EvolutionURL: getEnv("EVOLUTION_API_URL", "http://localhost:8080"),
		EvolutionKey: getEnv("EVOLUTION_API_KEY", ""),
		Env:          getEnv("APP_ENV", "development"),
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func (c *Config) IsProd() bool {
	return c.Env == "production"
}
