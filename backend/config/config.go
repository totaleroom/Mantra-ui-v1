package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	Port              string
	DatabaseURL       string
	RedisURL          string
	JWTSecret         string
	CORSOrigins       []string
	FrontendURL       string
	EvolutionURL      string
	EvolutionKey      string
	EvolutionInstance string
	// PublicBackendURL is the externally-reachable URL that Evolution API
	// will call for webhooks (e.g. https://api.mantra.yourdomain.com).
	// If empty, webhook auto-registration is skipped.
	PublicBackendURL string
	// WebhookSecret authenticates incoming Evolution webhooks via the
	// "X-Webhook-Secret" header. Required in production.
	WebhookSecret    string
	HermesAuthToken  string
	AgentCallbackURL string
	Env              string
}

var C *Config

// Load reads all environment variables and populates the global Config.
// EVO_* vars are the canonical names; EVOLUTION_API_* are accepted as legacy fallbacks.
// Missing required vars in production cause a fatal panic.
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

	evoURL := firstNonEmpty(
		os.Getenv("EVO_API_URL"),
		os.Getenv("EVOLUTION_API_URL"),
		"http://localhost:8080",
	)
	evoKey := firstNonEmpty(
		os.Getenv("EVO_API_KEY"),
		os.Getenv("EVOLUTION_API_KEY"),
		"",
	)

	C = &Config{
		Port:              getEnv("PORT", "3001"),
		DatabaseURL:       getEnv("DATABASE_URL", ""),
		RedisURL:          getEnv("REDIS_URL", "redis://localhost:6379"),
		JWTSecret:         getEnv("JWT_SECRET", "change-me-in-production-please"),
		CORSOrigins:       corsOrigins,
		FrontendURL:       frontendURL,
		EvolutionURL:      evoURL,
		EvolutionKey:      evoKey,
		EvolutionInstance: getEnv("EVO_INSTANCE_NAME", "mantra_instance"),
		PublicBackendURL:  getEnv("PUBLIC_BACKEND_URL", ""),
		WebhookSecret:     getEnv("WEBHOOK_SECRET", ""),
		HermesAuthToken:   getEnv("HERMES_AUTH_TOKEN", ""),
		AgentCallbackURL:  getEnv("AGENT_CALLBACK_URL", ""),
		Env:               getEnv("APP_ENV", "development"),
	}

	if C.IsProd() {
		validateRequired()
	}
}

// validateRequired panics with a clear message if any production-required
// variable is missing. Called automatically by Load() in production.
func validateRequired() {
	required := []struct{ key, val, desc string }{
		{"JWT_SECRET / JWT_SECRET", C.JWTSecret, "JWT signing secret"},
		{"DATABASE_URL", C.DatabaseURL, "PostgreSQL connection string"},
		{"FRONTEND_URL", C.FrontendURL, "Frontend URL for CORS"},
		{"EVO_API_KEY / EVOLUTION_API_KEY", C.EvolutionKey, "Evolution API key"},
		{"EVO_API_URL / EVOLUTION_API_URL", C.EvolutionURL, "Evolution API URL"},
		{"WEBHOOK_SECRET", C.WebhookSecret, "Shared secret Evolution sends in X-Webhook-Secret header"},
		{"PUBLIC_BACKEND_URL", C.PublicBackendURL, "Public URL Evolution calls for webhooks (e.g. https://api.example.com)"},
		{"HERMES_AUTH_TOKEN", C.HermesAuthToken, "Hermes agent auth token"},
	}

	var missing []string
	for _, r := range required {
		if r.val == "" || r.val == "change-me-in-production-please" || r.val == "http://localhost:8080" {
			missing = append(missing, fmt.Sprintf("  • %-40s → %s", r.key, r.desc))
		}
	}
	if len(missing) > 0 {
		panic(fmt.Sprintf(
			"[Mantra] Missing required environment variables:\n%s\n\nSet them before starting in production.",
			strings.Join(missing, "\n"),
		))
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

func (c *Config) IsProd() bool {
	return c.Env == "production"
}
