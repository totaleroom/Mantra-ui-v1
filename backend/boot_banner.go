package main

// Boot banner — the first thing a human or agent sees in the logs
// after the server starts. Designed to answer three questions in one
// screen-full:
//
//   1. "Did the backend actually come up, or is it stuck?"
//   2. "Is the config sane, or is there a time-bomb waiting?"
//   3. "What URL should I hit next?"
//
// Prints a fixed-width checklist with ✓ / ⚠ / ✗ markers. In production
// any ✗ aborts startup (log.Fatal) so Coolify doesn't mark a broken
// deploy as healthy. Warnings are tolerated and shown amber.
//
// All output goes through the standard logger so it interleaves
// correctly with the access log.

import (
	"fmt"
	"log"
	"strings"
	"time"

	"mantra-backend/config"
	"mantra-backend/database"
	"mantra-backend/models"
)

type bannerLine struct {
	ok      bool     // false = warn/fail
	fatal   bool     // true = abort startup in production
	label   string
	detail  string
	fixHint string
}

const (
	okGlyph    = "✓"
	warnGlyph  = "!"
	failGlyph  = "✗"
	boxH       = "─"
	boxV       = "│"
	boxTL, boxTR = "┌", "┐"
	boxBL, boxBR = "└", "┘"
)

// PrintBootBanner prints a startup checklist and, in production, aborts
// if any line is fatal. Call this AFTER database.ConnectPostgres and
// database.ConnectRedis, but BEFORE app.Listen.
func PrintBootBanner() {
	lines := collectBannerLines()

	width := 78
	hr := strings.Repeat(boxH, width-2)
	fmt.Println()
	fmt.Println(boxTL + hr + boxTR)
	fmt.Println(centerLine("Mantra AI · Backend Boot Report", width))
	fmt.Println(centerLine(
		fmt.Sprintf("env=%s · pid-up=%s", config.C.Env, time.Now().UTC().Format(time.RFC3339)),
		width,
	))
	fmt.Println(boxV + strings.Repeat(" ", width-2) + boxV)

	var fatals []bannerLine
	for _, l := range lines {
		printBannerLine(l, width)
		if l.fatal && !l.ok {
			fatals = append(fatals, l)
		}
	}

	fmt.Println(boxV + strings.Repeat(" ", width-2) + boxV)
	fmt.Println(centerLine(
		fmt.Sprintf("Listening on :%s  ·  /health  ·  /api/system/preflight", config.C.Port),
		width,
	))
	fmt.Println(boxBL + hr + boxBR)
	fmt.Println()

	if len(fatals) > 0 && config.C.IsProd() {
		log.Println("[Boot] FATAL checks in production mode — refusing to start.")
		for _, l := range fatals {
			log.Printf("[Boot]   ✗ %s — %s", l.label, l.detail)
			if l.fixHint != "" {
				log.Printf("[Boot]     fix: %s", l.fixHint)
			}
		}
		log.Fatalf("[Boot] Aborting. Fix the %d issue(s) above and retry.", len(fatals))
	}
}

func printBannerLine(l bannerLine, width int) {
	glyph := okGlyph
	if !l.ok {
		if l.fatal {
			glyph = failGlyph
		} else {
			glyph = warnGlyph
		}
	}
	// Format: "│ ✓ Label ............................ detail │"
	labelCol := 28
	if len(l.label) > labelCol {
		l.label = l.label[:labelCol-1] + "…"
	}
	pad := labelCol - len(l.label)
	inner := fmt.Sprintf(" %s %s%s  %s", glyph, l.label, strings.Repeat(" ", pad), l.detail)
	if len(inner) > width-2 {
		inner = inner[:width-5] + "…"
	}
	inner += strings.Repeat(" ", width-2-len(inner))
	fmt.Println(boxV + inner + boxV)
}

func centerLine(s string, width int) string {
	if len(s) > width-2 {
		s = s[:width-5] + "…"
	}
	pad := (width - 2 - len(s)) / 2
	right := width - 2 - len(s) - pad
	return boxV + strings.Repeat(" ", pad) + s + strings.Repeat(" ", right) + boxV
}

func collectBannerLines() []bannerLine {
	out := []bannerLine{}

	// ── Infrastructure ─────────────────────────────────────────
	if database.DB != nil {
		var tables int64
		database.DB.Raw(
			`SELECT count(*) FROM information_schema.tables WHERE table_schema='public'`,
		).Scan(&tables)
		out = append(out, bannerLine{
			ok:     tables >= 10,
			fatal:  tables == 0,
			label:  "PostgreSQL",
			detail: fmt.Sprintf("connected, %d tables", tables),
			fixHint: "docker compose logs postgres | tail -30 " +
				"and re-run backend/database/init.sql if tables are missing",
		})
	} else {
		out = append(out, bannerLine{
			ok:      false,
			fatal:   true,
			label:   "PostgreSQL",
			detail:  "NOT CONNECTED",
			fixHint: "check DATABASE_URL env var and postgres container health",
		})
	}

	if database.Redis != nil {
		out = append(out, bannerLine{
			ok:     true,
			label:  "Redis",
			detail: "connected",
		})
	} else {
		out = append(out, bannerLine{
			ok:      false,
			fatal:   false, // degraded, not fatal
			label:   "Redis",
			detail:  "unavailable (caching + rate-limit persistence off)",
			fixHint: "set REDIS_URL=redis://redis:6379",
		})
	}

	// ── Config ─────────────────────────────────────────────────
	out = append(out, jwtSecretLine())
	out = append(out, webhookSecretLine())
	out = append(out, frontendURLLine())

	if config.C.EvolutionURL == "" {
		out = append(out, bannerLine{
			ok: false, fatal: false,
			label:  "Evolution API URL",
			detail: "not set (WhatsApp gateway disabled)",
			fixHint: "set EVO_API_URL=http://evolution:8080 if you want WA integration",
		})
	} else {
		out = append(out, bannerLine{
			ok: true, label: "Evolution API URL", detail: config.C.EvolutionURL,
		})
	}

	// ── Bootstrap ──────────────────────────────────────────────
	if database.DB != nil {
		var users, stale, clients int64
		database.DB.Model(&models.User{}).Count(&users)
		database.DB.Model(&models.Client{}).Count(&clients)
		database.DB.Model(&models.User{}).
			Where("email IN ? AND must_change_password = ?",
				[]string{"admin@mantra.ai", "demo@mantra.ai"}, true).
			Count(&stale)

		out = append(out, bannerLine{
			ok:      users > 0,
			fatal:   users == 0,
			label:   "Bootstrap users",
			detail:  fmt.Sprintf("%d present", users),
			fixHint: "re-run init.sql; it seeds admin@mantra.ai + demo@mantra.ai",
		})
		out = append(out, bannerLine{
			ok:     clients > 0,
			label:  "Tenants (clients)",
			detail: fmt.Sprintf("%d present", clients),
		})
		if stale > 0 {
			out = append(out, bannerLine{
				ok: false, fatal: false,
				label:   "Default password rotated",
				detail:  fmt.Sprintf("%d seeded account(s) still on default", stale),
				fixHint: "log in, rotate via /change-password — app forces this automatically",
			})
		} else if users > 0 {
			out = append(out, bannerLine{
				ok: true, label: "Default password rotated",
				detail: "all seeded accounts have rotated",
			})
		}
	}

	return out
}

func jwtSecretLine() bannerLine {
	s := config.C.JWTSecret
	switch {
	case s == "":
		return bannerLine{
			ok: false, fatal: true,
			label: "JWT_SECRET", detail: "EMPTY",
			fixHint: "openssl rand -base64 48  →  set JWT_SECRET env",
		}
	case strings.Contains(s, "change-me") || strings.Contains(s, "placeholder"):
		return bannerLine{
			ok: false, fatal: true,
			label: "JWT_SECRET", detail: "looks like a placeholder",
			fixHint: "generate a real secret: ./scripts/generate-env.sh",
		}
	case len(s) < 32:
		return bannerLine{
			ok: false, fatal: false,
			label: "JWT_SECRET", detail: fmt.Sprintf("short (%d chars, ≥32 recommended)", len(s)),
			fixHint: "rotate to openssl rand -base64 48 when you can take a session flush",
		}
	default:
		return bannerLine{
			ok: true, label: "JWT_SECRET",
			detail: fmt.Sprintf("strong (%d chars)", len(s)),
		}
	}
}

func webhookSecretLine() bannerLine {
	if config.C.WebhookSecret == "" {
		if config.C.IsProd() {
			return bannerLine{
				ok: false, fatal: true,
				label: "WEBHOOK_SECRET", detail: "EMPTY in production",
				fixHint: "set WEBHOOK_SECRET; Evolution webhooks will be rejected otherwise",
			}
		}
		return bannerLine{
			ok: false, fatal: false,
			label: "WEBHOOK_SECRET", detail: "dev mode: not set (webhooks unsigned)",
		}
	}
	return bannerLine{
		ok: true, label: "WEBHOOK_SECRET", detail: "configured",
	}
}

func frontendURLLine() bannerLine {
	if config.C.FrontendURL == "" {
		if config.C.IsProd() {
			return bannerLine{
				ok: false, fatal: true,
				label: "FRONTEND_URL", detail: "EMPTY in production",
				fixHint: "set FRONTEND_URL=https://<your-domain>",
			}
		}
		return bannerLine{
			ok: false, fatal: false,
			label: "FRONTEND_URL", detail: "dev default (localhost)",
		}
	}
	if config.C.IsProd() && strings.HasPrefix(config.C.FrontendURL, "http://") {
		return bannerLine{
			ok: false, fatal: false,
			label: "FRONTEND_URL", detail: "plain HTTP in production",
			fixHint: "attach TLS via Coolify + switch to https://",
		}
	}
	return bannerLine{
		ok: true, label: "FRONTEND_URL", detail: config.C.FrontendURL,
	}
}
