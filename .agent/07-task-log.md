# 07 — Task Log

> Append-only. Newest on top. Each entry: what, why, how verified, follow-ups.
> Previous agents wrote the entries below. Add yours before ending your session.

---

## 2026-04-17 — Hermes handoff + single-user deployment docs

**Agent**: Cascade

**What**:
- `.agent/08-hermes-handoff.md` — Hermes's operating envelope: what he can
  do without asking, what requires approval, credential locations, standard
  workflow, escalation path, identity discipline.
- `.agent/09-single-user-deployment.md` — Tailscale + Coolify topology
  variant. Documents that Evolution → backend webhook is container-internal
  (`http://backend:3001`), so no public domain is required.
- `scripts/hermes-check.sh` — pre-flight check script: validates tools,
  repo, docker services, health endpoint, disk, Tailscale. Exits non-zero
  on failure so Hermes can auto-detect broken VPS state.
- `.env.example` — added header explaining the two supported deployment
  profiles (public SaaS vs single-user Tailscale).
- `.agent/README.md` — reading order now includes files 08 and 09.

**Why**: Operator will run Hermes as a persistent coding agent on the VPS.
Needed explicit boundaries + onboarding so Hermes (or any successor agent)
can pick up work without the operator re-briefing. Also operator chose
single-user Tailscale topology — documented the simplifications vs the
generic public-SaaS assumptions baked into the original README/DEPLOY.

**How verified**: Documentation-only + shell script. `tsc` + `next build`
not re-run (no JS/TS/Go touched). Shell script is bash strict-mode and
uses only POSIX + docker/tailscale tools.

**Follow-ups**:
- When operator installs Hermes on VPS, confirm `scripts/hermes-check.sh`
  actually exits 0 in the healthy state and produces useful output.
- Consider adding `scripts/backup.sh` (documented inline in 09 but not
  committed as a file). Low priority — operator can copy from docs.
- If operator later buys a domain + goes multi-tenant, the migration
  procedure is in `09-single-user-deployment.md § When you migrate`.

---

## 2026-04-17 — Skill pack `.agent/` created

**Agent**: Cascade (Sonnet 4.5)

**What**: Created `.agent/` directory with 7 markdown files documenting
mission, architecture, codebase map, conventions, runbooks, gotchas,
verification, and this log.

**Why**: User wants any future AI to pick up the work without losing context
(e.g. when current agent hits quota limits).

**How verified**: N/A — documentation-only change. No code impact.

**Follow-ups**:
- Keep `05-gotchas.md` updated — add a new entry every time we waste ≥30 min
  on a reproduction.
- Consider moving the `README.md` § "Message Flow" diagram into
  `01-architecture.md` to avoid drift.

---

## 2026-04-17 — Dev preview infrastructure

**Agent**: Cascade

**What**:
- Created `.env.local` for UI-only preview (DEV_AUTH_BYPASS=true).
- Pinned `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` to stop restart-induced
  "Invalid Server Actions request" errors.
- Added `experimental.serverActions.allowedOrigins` in `next.config.mjs` to
  whitelist Windsurf browser-preview proxy ports.

**Why**: User wanted to see the running UI without having Docker Desktop up.

**How verified**: Manually — `npx next dev -p 5000` started clean, login
route rendered. User then hit G2 (origin mismatch); documented that in
gotchas with two-option fix.

**Follow-ups**: If Windsurf proxy assigns ports outside the current allowlist
range (52446–52450), user will need to append. Consider a cleaner long-term
fix (disable Server Actions origin check in dev, or dynamic detection).

---

## 2026-04-17 — Gelombang 5: core messaging pipeline

**Agent**: Cascade

**What**: Implemented the end-to-end AI auto-reply flow that was missing
from the prior commits. New files:

- `backend/services/orchestrator.go` — provider-agnostic pipeline
- `backend/handlers/webhooks.go` — Evolution webhook receiver with
  constant-time secret auth
- `components/inbox/reply-composer.tsx` — manual reply UI

Changed:

- `backend/services/evolution.go` — added `SendText()`, `SetWebhook()`
- `backend/handlers/whatsapp.go` — `SendWhatsAppMessage`, auto-register
  webhook on CreateInstance
- `backend/routes/routes.go` — new routes, rate-limited webhook
- `backend/main.go` — wired `Orchestrator.OnMessagePersisted` →
  `InboxHub.BroadcastMessage`
- `backend/config/config.go` — `WebhookSecret`, `PublicBackendURL`
- `backend/Dockerfile` — Go 1.22 → 1.25, added `go mod tidy`
- `docker-compose.yaml` — pass WEBHOOK_SECRET, PUBLIC_BACKEND_URL
- `hooks/use-whatsapp.ts` — `useSendWhatsAppMessage` mutation
- `app/inbox/page.tsx` — mount ReplyComposer
- `README.md` — added Message Flow diagram + 7-step smoke test + triage table

**Why**: Without this, the app had no way to actually send/receive WA
messages. Dashboard was decorative. This is the bulk of the MVP delta.

**How verified**:
- `npx tsc --noEmit` clean
- `npx next build` clean (13 routes)
- Go compile: **NOT run** (Docker Desktop was down on user's laptop).
  Manually grep-verified every cross-file reference:
  `handlers.Orchestrator` exists, `HandleInbound`/`SendManual` signatures
  match call sites in `webhooks.go` and `whatsapp.go`, wiring in `main.go`
  resolves.

**Follow-ups**:
- **Must run `docker compose up --build` once** on the VPS before
  production to catch any Go issue that pure grep missed.
- Add Sentry / log aggregation for production observability (Gelombang 6).
- Consider exact token accounting using `usage` field from OpenAI response
  instead of char-based approximation in `orchestrator.go::updateMemory`.

---

## 2026-04-17 — Gelombang 3: frontend polish

**Agent**: Cascade

**What**:
- `components/command-palette.tsx` — global ⌘K palette
- `components/feedback/{empty-state,error-fallback,page-loading}.tsx`
- `app/{error,global-error,loading,not-found}.tsx` — boundary pages
- `app/layout.tsx` — ThemeProvider + Toaster
- `components/dashboard/dashboard-layout.tsx` — mount CommandPalette
- `components/dashboard/header.tsx` — search button → palette trigger

**Why**: Dashboard felt barebones. These give a baseline premium feel
without adding functional scope.

**How verified**: `tsc` + `next build` clean.

**Follow-ups**: Add ARIA labels to palette items for accessibility.

---

## 2026-04-17 — Coolify migration + doc refresh

**Agent**: Cascade

**What**: Migrated deployment target from Cloudflare Tunnel / Replit to
Coolify + Traefik on Debian 12 VPS. Rewrote:

- `ARCHITECTURE.md` — updated deployment section
- `README.md` — Coolify-first quick starts, doc map, repo layout
- `DEVELOPMENT.md` — merged Replit-specific info, local dev instructions
- `DEPLOY_COOLIFY.md` — full guide
- `AI_AGENT_BRIEF.md` — updated reading order and deployment flow
- `docker-compose.yaml` — redis volume typo, secure port bindings,
  webhook env vars, quoted YAML values
- `next.config.mjs` — disabled deprecated eslint config, strict CSP
- `backend/handlers/auth.go` — bcrypt cost 12, JWT 8h + NotBefore, cookie
  alignment

**Why**: User wants one-VPS self-host via Coolify.

**How verified**: `tsc` + `next build`. Docker compose config validated
with `docker compose config`.

**Follow-ups**: Automated backup cron for Postgres (pg_dump → off-box).

---

## Template for your next entry

```md
## YYYY-MM-DD — <short title>

**Agent**: <model name>

**What**: <list of files changed + 1-line purpose each>

**Why**: <business reason, in human terms>

**How verified**: <which blocks from 06-verification.md you ran; paste key output>

**Follow-ups**: <things the next agent should know>
```
