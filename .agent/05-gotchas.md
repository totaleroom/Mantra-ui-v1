# 05 — Gotchas (Mistakes Already Made)

> Each entry has: **Symptom → Cause → Fix**. Read before debugging.

---

## G1 — "Invalid Server Actions request" during login render

**Symptom**: `Error: Invalid Server Actions request. Digest: XXXXX@E80` thrown
inside `<LoginForm>` render on page load, before the user even submits.

**Cause**: Stale `.next/dev` cache from a previous dev server that used a
different Server Actions encryption key. The browser has an action ID that
current dev server can't decrypt.

**Fix**:
```powershell
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
npx next dev -p 5000
```

**Prevention**: `.env.local` has a pinned `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
(valid base64, 32 bytes). Keep it set; don't regenerate casually.

---

## G2 — "x-forwarded-host does not match origin" on Server Action POST

**Symptom**: Login form 500s. Backend log:
```
x-forwarded-host header with value `localhost:5000` does not match
origin header with value `127.0.0.1:52446` from a forwarded Server Actions
request. Aborting the action.
```

**Cause**: Next.js 14+ Server Actions have a CSRF guard that requires Origin
host to match X-Forwarded-Host. Windsurf's `browser_preview` tool proxies
through `127.0.0.1:<dynamic-port>`, creating a mismatch.

**Fix**: Two options, in order of preference:
1. **Tell the user to open `http://localhost:5000` in their normal browser**
   (bypasses the proxy entirely).
2. Or append the Windsurf proxy port to `next.config.mjs ::
   experimental.serverActions.allowedOrigins`. See the existing list there.

---

## G3 — Docker Desktop not running on Windows

**Symptom**: `docker: Error response from daemon: Docker Desktop is unable to
start` on any docker command.

**Cause**: User hasn't launched Docker Desktop GUI, or WSL2 backend crashed.

**Fix**: **You cannot fix this.** Ask the user to start Docker Desktop
manually. Do not try `Start-Service`, `wsl --shutdown`, etc. without explicit
permission — those require admin and can break their dev env.

---

## G4 — Go build fails: "go.mod requires go 1.25"

**Symptom**: `go: go.mod requires go >= 1.25 (running go1.22)` when building.

**Cause**: Dockerfile using old Go image.

**Fix**: `backend/Dockerfile` must start with `FROM golang:1.25-alpine`.
Also `RUN go mod tidy` before `go build` to refresh deps.

---

## G5 — Frontend build fails on Vercel Analytics import

**Symptom**: `Module not found: Can't resolve '@vercel/analytics/react'`.

**Cause**: Legacy import from a prior template. We do NOT use Vercel Analytics.

**Fix**: Remove the import from wherever it appears (most likely
`app/layout.tsx`). Do not `pnpm add @vercel/analytics` — it's a dep we
deliberately removed.

---

## G6 — Cookie expires but JWT is still valid (or vice versa)

**Symptom**: User is "logged in" per middleware but server rejects their
requests, or opposite.

**Cause**: `maxAge` in Set-Cookie and `exp` claim in JWT drift apart.

**Fix**: Both must be **28800 seconds (8 h)**. Check:
- `backend/handlers/auth.go::Login` — cookie maxAge
- Same file — `jwt.NewWithClaims` exp
- `lib/auth.ts::issueDevBypassToken` if dev bypass is in play

---

## G7 — Webhook received but orchestrator silent

**Symptom**: Backend logs show `[Webhook] accepted` but no subsequent
`[Orchestrator]` lines.

**Cause**: Orchestrator goroutine panicked silently, OR the client lookup
returned no rows.

**Fix**:
1. Check that the `instanceName` in the webhook matches a row in
   `whatsapp_instances` table.
2. Wrap the goroutine body with `defer func() { recover() }()` if flaky.

---

## G8 — AI returns reply but it never reaches customer

**Symptom**: Orchestrator logs show reply text, but no outbound in DB and
customer's phone gets nothing.

**Cause**: `EvolutionService.SendText` failed. Usually Evolution instance
disconnected since the webhook fired.

**Fix**: Check instance status on the dashboard. Rescan QR if needed. Check
`backend/services/evolution.go::SendText` error logs — Evolution returns HTTP
4xx with a JSON error that we log verbatim.

---

## G9 — `all providers failed` in AI call

**Symptom**: `[AIFallback] all providers failed` in backend logs.

**Cause**: Either no `ai_providers` row is `is_active = true`, or every active
provider's API key is bad.

**Fix**:
1. Dashboard → AI Hub → ensure at least one provider is Active.
2. Test each provider with the dashboard "Test" button.
3. Check `last_error` column in `ai_providers` table.

---

## G10 — Inbox page shows nothing despite backend having messages

**Symptom**: `/api/inbox/messages` returns 0 rows even though DB has data.

**Cause**: Tenant isolation. The query filters by `client_id IN (user's
clients)`. Super admin sees all; client admin only sees their own.

**Fix**: Verify JWT claims carry the right `role` and `client_ids`. Check
`backend/middleware/auth.go` tenant-scope injection.

---

## G11 — WebSocket disconnects every 60 seconds

**Symptom**: Inbox live feed goes dead after exactly 60 s, reconnects, repeats.

**Cause**: Traefik default idle timeout. Without pings the connection is
killed.

**Fix**: `backend/ws/inbox_ws.go` already sends a ping every 30 s. If the
Traefik config in Coolify overrides this, bump it or ensure keep-alive is
enabled for WS upgrades.

---

## G12 — Redis volume typo in docker-compose

**Symptom**: Redis data vanishes on container recreate.

**Cause**: Historical typo — `redis-data` vs `redis_data` in volumes section.

**Fix**: Already fixed. If you see it again, match volume name exactly to the
top-level `volumes:` declaration.

---

## G13 — CSP blocks inline styles or fonts

**Symptom**: Console `Refused to apply inline style because it violates the
following CSP directive`.

**Cause**: `next.config.mjs` CSP is strict in prod. Dev allows unsafe-inline.

**Fix**: Never add `'unsafe-inline'` to prod CSP just to silence this. Instead,
move the style into a Tailwind class or a CSS module. Fonts: add the CDN
origin to `font-src` directive.

---

## G14 — `pnpm install` vs `npm install` — which?

**Symptom**: Lockfile conflicts, "multi lockfile" warnings from Turbopack.

**Cause**: We use **pnpm**. There's one lockfile: `pnpm-lock.yaml`.

**Fix**: Never commit `package-lock.json` or `yarn.lock`. `next.config.mjs`
sets `turbopack.root` to silence false-positive multi-lockfile warnings if
the user has stray lockfiles elsewhere.
