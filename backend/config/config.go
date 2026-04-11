package config

import (
	"os"
	"strings"
)

type Config struct {
	Port           string
	DatabaseURL    string
	RedisURL       string
	JWTSecret      string
	CORSOrigins    []string
	EvolutionURL   string
	EvolutionKey   string
	Env            string
}

var C *Config

func Load() {
	origins := os.Getenv("CORS_ORIGINS")
	var corsOrigins []string
	if origins != "" {
		for _, o := range strings.Split(origins, ",") {
			corsOrigins = append(corsOrigins, strings.TrimSpace(o))
		}
	} else {
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
