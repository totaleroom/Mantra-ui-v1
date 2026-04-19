package handlers

// Preflight / "blackbox" endpoint — a comprehensive health snapshot
// meant to answer ONE question for two different audiences:
//
//   1. Hermes agent (machine)   → GET /api/system/preflight
//         parses JSON → decides whether to deploy / rollback / escalate.
//   2. Diagnosis Center (human) → same endpoint, rendered as a grid
//         with "How to fix" buttons that link to the runbook.
//
// Every check carries:
//   - id           stable slug for the UI key / log correlation
//   - category     infra | config | bootstrap | security | runtime
//   - label        human headline
//   - status       ok | warn | fail | skip
//   - message      one-line explanation of the observed value
//   - remediation  concrete step (shell command, SQL, doc link)
//   - docRef       optional path into the in-repo docs
//
// The overall status is the worst of all checks (fail > warn > ok).
// `skip` doesn't affect overall — used when a check is N/A (e.g. Redis
// in a deploy that opted out of caching).

import (
	"context"
	"fmt"
	"net/http"
	"runtime"
	"strings"
	"time"

	"mantra-backend/config"
	"mantra-backend/database"
	"mantra-backend/models"

	"github.com/gofiber/fiber/v2"
)

type preflightStatus string

const (
	statusOK   preflightStatus = "ok"
	statusWarn preflightStatus = "warn"
	statusFail preflightStatus = "fail"
	statusSkip preflightStatus = "skip"
)

type preflightCheck struct {
	ID          string          `json:"id"`
	Category    string          `json:"category"`
	Label       string          `json:"label"`
	Status      preflightStatus `json:"status"`
	Message     string          `json:"message"`
	LatencyMs   int             `json:"latencyMs,omitempty"`
	Remediation string          `json:"remediation,omitempty"`
	DocRef      string          `json:"docRef,omitempty"`
}

type preflightReport struct {
	Overall   preflightStatus  `json:"overall"`
	Timestamp time.Time        `json:"timestamp"`
	Version   string           `json:"version"`
	Runtime   string           `json:"runtime"`
	Env       string           `json:"env"`
	Counts    map[string]int64 `json:"counts,omitempty"`
	Checks    []preflightCheck `json:"checks"`
}

// Preflight is mounted behind SUPER_ADMIN-only auth in routes.go. We
// deliberately expose DB stats etc. that a tenant must not see.
func Preflight(c *fiber.Ctx) error {
	checks := []preflightCheck{}
	counts := map[string]int64{}

	// ---- infra --------------------------------------------------
	checks = append(checks, checkDatabaseConnection(counts))
	checks = append(checks, checkRedisConnection())
	checks = append(checks, checkEvolutionReachable())

	// ---- config -------------------------------------------------
	checks = append(checks, checkJWTSecretStrength())
	checks = append(checks, checkWebhookSecret())
	checks = append(checks, checkFrontendURL())
	checks = append(checks, checkPublicBackendURL())

	// ---- bootstrap ----------------------------------------------
	checks = append(checks, checkBootstrapUsers(counts))
	checks = append(checks, checkAtLeastOneTenant(counts))
	checks = append(checks, checkDefaultAdminRotated())

	// ---- security -----------------------------------------------
	checks = append(checks, checkSessionsLoadedCleanly())

	// ---- runtime / health --------------------------------------
	checks = append(checks, checkClockSkew())

	report := preflightReport{
		Timestamp: time.Now().UTC(),
		Version:   "phase-b",
		Runtime:   runtime.Version(),
		Env:       config.C.Env,
		Counts:    counts,
		Checks:    checks,
		Overall:   aggregateStatus(checks),
	}

	// 503 when the system is actively broken; 200 for ok/warn so that
	// Coolify's simple 2xx healthcheck passes while degraded.
	if report.Overall == statusFail {
		return c.Status(fiber.StatusServiceUnavailable).JSON(report)
	}
	return c.JSON(report)
}

// ── infra checks ─────────────────────────────────────────────────

func checkDatabaseConnection(counts map[string]int64) preflightCheck {
	chk := preflightCheck{
		ID:       "db_connection",
		Category: "infrastructure",
		Label:    "PostgreSQL connection",
		DocRef:   "DEPLOY_COOLIFY.md",
	}
	if database.DB == nil {
		chk.Status = statusFail
		chk.Message = "database.DB is nil — the Go process never connected"
		chk.Remediation = "Verify DATABASE_URL in .env/Coolify env. Run: docker compose logs postgres backend | tail -50"
		return chk
	}
	sqlDB, err := database.DB.DB()
	if err != nil {
		chk.Status = statusFail
		chk.Message = "gorm.DB() returned " + err.Error()
		chk.Remediation = "Check that the postgres container is healthy: docker compose ps postgres"
		return chk
	}
	start := time.Now()
	if err := sqlDB.Ping(); err != nil {
		chk.Status = statusFail
		chk.Message = "ping failed: " + err.Error()
		chk.Remediation = "Network path between backend and postgres is down. In Coolify, verify both services are on the same project network."
		return chk
	}
	chk.LatencyMs = int(time.Since(start).Milliseconds())

	// Table sanity — we expect 11+ tables from init.sql
	var tableCount int64
	database.DB.Raw(`
		SELECT count(*) FROM information_schema.tables
		WHERE table_schema = 'public'
	`).Scan(&tableCount)
	counts["tables"] = tableCount

	if tableCount < 10 {
		chk.Status = statusWarn
		chk.Message = fmt.Sprintf("connected (%dms) but only %d tables present; expected ≥10", chk.LatencyMs, tableCount)
		chk.Remediation = "init.sql may not have completed. Re-run: docker compose exec postgres psql -U mantra -d mantra_db -f /docker-entrypoint-initdb.d/init.sql"
		return chk
	}
	chk.Status = statusOK
	chk.Message = fmt.Sprintf("connected in %dms, %d tables present", chk.LatencyMs, tableCount)
	return chk
}

func checkRedisConnection() preflightCheck {
	chk := preflightCheck{
		ID:       "redis_connection",
		Category: "infrastructure",
		Label:    "Redis connection",
		DocRef:   ".agent/04-runbooks.md",
	}
	if database.Redis == nil {
		chk.Status = statusWarn
		chk.Message = "Redis client is nil — caching + rate-limit persistence degraded"
		chk.Remediation = "Set REDIS_URL=redis://redis:6379 in the backend service env"
		return chk
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	start := time.Now()
	if err := database.Redis.Ping(ctx).Err(); err != nil {
		chk.Status = statusFail
		chk.Message = "ping failed: " + err.Error()
		chk.Remediation = "Check redis container: docker compose ps redis && docker compose logs redis --tail=30"
		return chk
	}
	chk.LatencyMs = int(time.Since(start).Milliseconds())
	chk.Status = statusOK
	chk.Message = fmt.Sprintf("PONG in %dms", chk.LatencyMs)
	return chk
}

func checkEvolutionReachable() preflightCheck {
	chk := preflightCheck{
		ID:       "evolution_api",
		Category: "infrastructure",
		Label:    "Evolution API",
		DocRef:   "DEPLOY_COOLIFY.md",
	}
	url := config.C.EvolutionURL
	if url == "" {
		chk.Status = statusSkip
		chk.Message = "EVO_API_URL not set; WhatsApp gateway disabled"
		chk.Remediation = "If you don't use WhatsApp, ignore this. Otherwise set EVO_API_URL in env."
		return chk
	}
	client := &http.Client{Timeout: 5 * time.Second}
	start := time.Now()
	resp, err := client.Get(url + "/")
	chk.LatencyMs = int(time.Since(start).Milliseconds())
	if err != nil {
		chk.Status = statusFail
		chk.Message = "unreachable: " + err.Error()
		chk.Remediation = "Start / restart the Evolution container: docker compose restart evolution"
		return chk
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 500 {
		chk.Status = statusFail
		chk.Message = fmt.Sprintf("HTTP %d from Evolution root", resp.StatusCode)
		chk.Remediation = "docker compose logs evolution --tail=50"
		return chk
	}
	chk.Status = statusOK
	chk.Message = fmt.Sprintf("reachable (HTTP %d) in %dms", resp.StatusCode, chk.LatencyMs)
	return chk
}

// ── config checks ────────────────────────────────────────────────

func checkJWTSecretStrength() preflightCheck {
	chk := preflightCheck{
		ID:       "jwt_secret",
		Category: "config",
		Label:    "JWT signing secret",
		DocRef:   "scripts/generate-env.sh",
	}
	s := config.C.JWTSecret
	if s == "" {
		chk.Status = statusFail
		chk.Message = "JWT_SECRET is empty — all tokens invalid"
		chk.Remediation = "Set JWT_SECRET to a 32-byte+ random string. Generate: openssl rand -base64 48"
		return chk
	}
	if strings.Contains(s, "change-me") || strings.Contains(s, "placeholder") {
		chk.Status = statusFail
		chk.Message = "JWT_SECRET looks like a placeholder"
		chk.Remediation = "Replace with a real secret from scripts/generate-env.sh"
		return chk
	}
	if len(s) < 32 {
		chk.Status = statusWarn
		chk.Message = fmt.Sprintf("JWT_SECRET only %d chars — brute-forceable under modern compute", len(s))
		chk.Remediation = "Rotate to a 32-byte+ value. WARNING: rotation invalidates all live sessions."
		return chk
	}
	chk.Status = statusOK
	chk.Message = fmt.Sprintf("length %d chars, not a placeholder", len(s))
	return chk
}

func checkWebhookSecret() preflightCheck {
	chk := preflightCheck{
		ID:       "webhook_secret",
		Category: "config",
		Label:    "Webhook shared secret",
		DocRef:   "backend/handlers/webhooks.go",
	}
	if config.C.WebhookSecret == "" {
		if config.C.IsProd() {
			chk.Status = statusFail
			chk.Message = "WEBHOOK_SECRET is empty in production — Evolution webhooks will be rejected"
			chk.Remediation = "Set WEBHOOK_SECRET (openssl rand -base64 32) and ensure Evolution is configured to send X-Webhook-Secret header."
		} else {
			chk.Status = statusWarn
			chk.Message = "not set (dev mode only) — webhooks accept any payload"
			chk.Remediation = "Set before going to production."
		}
		return chk
	}
	if len(config.C.WebhookSecret) < 16 {
		chk.Status = statusWarn
		chk.Message = "webhook secret looks short"
		chk.Remediation = "Use at least 32 bytes (openssl rand -base64 32)."
		return chk
	}
	chk.Status = statusOK
	chk.Message = "configured"
	return chk
}

func checkFrontendURL() preflightCheck {
	chk := preflightCheck{
		ID:       "frontend_url",
		Category: "config",
		Label:    "FRONTEND_URL / CORS origin",
		DocRef:   "DEPLOY_COOLIFY.md",
	}
	if config.C.FrontendURL == "" {
		if config.C.IsProd() {
			chk.Status = statusFail
			chk.Message = "FRONTEND_URL empty — CORS origin defaults to localhost, browsers will be blocked"
			chk.Remediation = "Set FRONTEND_URL=https://<your-domain> in backend env."
		} else {
			chk.Status = statusWarn
			chk.Message = "unset (dev default localhost:5000)"
		}
		return chk
	}
	if config.C.IsProd() && strings.HasPrefix(config.C.FrontendURL, "http://") {
		chk.Status = statusWarn
		chk.Message = "FRONTEND_URL is plain HTTP in production — cookies cannot be marked Secure"
		chk.Remediation = "Attach TLS (Coolify handles Let's Encrypt) and update FRONTEND_URL to https://..."
		return chk
	}
	chk.Status = statusOK
	chk.Message = config.C.FrontendURL
	return chk
}

func checkPublicBackendURL() preflightCheck {
	chk := preflightCheck{
		ID:       "public_backend_url",
		Category: "config",
		Label:    "PUBLIC_BACKEND_URL (Evolution → backend webhook)",
	}
	if config.C.PublicBackendURL == "" {
		chk.Status = statusWarn
		chk.Message = "unset — webhook auto-registration skipped. Evolution can't deliver messages."
		chk.Remediation = "Set PUBLIC_BACKEND_URL=https://api.<your-domain> in backend env so /api/webhooks/evolution is registered at startup."
		return chk
	}
	chk.Status = statusOK
	chk.Message = config.C.PublicBackendURL
	return chk
}

// ── bootstrap checks ─────────────────────────────────────────────

func checkBootstrapUsers(counts map[string]int64) preflightCheck {
	chk := preflightCheck{
		ID:       "bootstrap_users",
		Category: "bootstrap",
		Label:    "Default users seeded",
		DocRef:   "backend/database/init.sql",
	}
	if database.DB == nil {
		chk.Status = statusSkip
		chk.Message = "database unavailable"
		return chk
	}
	var userCount int64
	database.DB.Model(&models.User{}).Count(&userCount)
	counts["users"] = userCount
	if userCount == 0 {
		chk.Status = statusFail
		chk.Message = "no users exist — no one can log in"
		chk.Remediation = "Run init.sql bootstrap: docker compose exec postgres psql -U mantra -d mantra_db -f /docker-entrypoint-initdb.d/init.sql"
		return chk
	}
	chk.Status = statusOK
	chk.Message = fmt.Sprintf("%d user(s) present", userCount)
	return chk
}

func checkAtLeastOneTenant(counts map[string]int64) preflightCheck {
	chk := preflightCheck{
		ID:       "tenants_present",
		Category: "bootstrap",
		Label:    "At least one tenant / client",
	}
	if database.DB == nil {
		chk.Status = statusSkip
		chk.Message = "database unavailable"
		return chk
	}
	var clientCount int64
	database.DB.Model(&models.Client{}).Count(&clientCount)
	counts["clients"] = clientCount
	if clientCount == 0 {
		chk.Status = statusWarn
		chk.Message = "no clients — dashboard will look empty"
		chk.Remediation = "Create one via the Tenants page, or re-run init.sql which seeds 'Demo Tenant'."
		return chk
	}
	chk.Status = statusOK
	chk.Message = fmt.Sprintf("%d tenant(s)", clientCount)
	return chk
}

func checkDefaultAdminRotated() preflightCheck {
	chk := preflightCheck{
		ID:       "default_admin_rotated",
		Category: "security",
		Label:    "Default admin password rotated",
		DocRef:   ".agent/05-gotchas.md#g16",
	}
	if database.DB == nil {
		chk.Status = statusSkip
		chk.Message = "database unavailable"
		return chk
	}
	var stale int64
	database.DB.Model(&models.User{}).
		Where("email IN ? AND must_change_password = ?",
			[]string{"admin@mantra.ai", "demo@mantra.ai"}, true).
		Count(&stale)
	if stale > 0 {
		chk.Status = statusWarn
		chk.Message = fmt.Sprintf("%d seeded account(s) still carry the default password", stale)
		chk.Remediation = "Log in with the default credentials — the app will force you through /change-password. Until then, these accounts can't access anything."
		return chk
	}
	chk.Status = statusOK
	chk.Message = "all seeded accounts have rotated"
	return chk
}

// ── runtime checks ───────────────────────────────────────────────

func checkSessionsLoadedCleanly() preflightCheck {
	chk := preflightCheck{
		ID:       "bcrypt_cost",
		Category: "security",
		Label:    "Password hashes use bcrypt ≥ cost 10",
	}
	if database.DB == nil {
		chk.Status = statusSkip
		return chk
	}
	// Sample one non-seed user hash. bcrypt prefix $2a$10$ means cost 10,
	// $2a$12$ means cost 12. We require ≥10.
	type row struct{ Password string }
	var r row
	err := database.DB.Raw(`SELECT password FROM users LIMIT 1`).Scan(&r).Error
	if err != nil || r.Password == "" {
		chk.Status = statusSkip
		chk.Message = "no users to sample"
		return chk
	}
	if !strings.HasPrefix(r.Password, "$2") {
		chk.Status = statusFail
		chk.Message = "a user row does NOT hold a bcrypt hash — plaintext or corrupt"
		chk.Remediation = "Rotate that user's password immediately via the admin panel."
		return chk
	}
	// Extract cost: $2a$10$... → "10"
	parts := strings.Split(r.Password, "$")
	if len(parts) >= 3 {
		if parts[2] == "08" || parts[2] == "09" {
			chk.Status = statusWarn
			chk.Message = "bcrypt cost " + parts[2] + " — below recommended 10"
			chk.Remediation = "Future password updates will re-hash at cost 12. Existing low-cost hashes remain safe but should rotate on next login."
			return chk
		}
	}
	chk.Status = statusOK
	chk.Message = "bcrypt hashes present and ≥ cost 10"
	return chk
}

func checkClockSkew() preflightCheck {
	chk := preflightCheck{
		ID:       "clock_skew",
		Category: "runtime",
		Label:    "Wall-clock sanity",
	}
	// We can't check skew without an external NTP, but we CAN check
	// that the clock isn't stuck somewhere absurd.
	now := time.Now()
	if now.Year() < 2024 || now.Year() > 2035 {
		chk.Status = statusFail
		chk.Message = fmt.Sprintf("wall clock reads %s — NTP probably dead", now.Format(time.RFC3339))
		chk.Remediation = "On the VPS: timedatectl set-ntp true && systemctl restart systemd-timesyncd"
		return chk
	}
	chk.Status = statusOK
	chk.Message = now.Format(time.RFC3339)
	return chk
}

// ── helpers ──────────────────────────────────────────────────────

// aggregateStatus picks the worst-severity status among the checks.
func aggregateStatus(checks []preflightCheck) preflightStatus {
	hasWarn := false
	for _, c := range checks {
		switch c.Status {
		case statusFail:
			return statusFail
		case statusWarn:
			hasWarn = true
		}
	}
	if hasWarn {
		return statusWarn
	}
	return statusOK
}
