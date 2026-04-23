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

---

## G15 — Every dashboard API call returns 401 after login (Phase B era)

**Symptom**: User can log in (cookie appears in DevTools), but every
subsequent page loads empty and the Network tab shows `/api/...` calls
returning **401 Unauthorized**. `mantra_session` cookie is present on
the frontend origin, but not the backend origin.

**Cause**: A caller is using the backend's **absolute URL** (e.g.
`http://localhost:3001/api/clients`) from the browser. That's
cross-origin vs the frontend's `app:5000`; the HttpOnly cookie is
scoped to the frontend origin, so it's never sent upstream.

**Fix**: Always call `/api/...` **relative** from the browser. The
Next.js `rewrites()` in `next.config.mjs` will proxy it server-side to
`BACKEND_INTERNAL_URL`. `lib/api-client.ts` is already correct — make
sure any ad-hoc `fetch()` you add follows suit. Server-side fetches
(Server Actions, RSC) may use `BACKEND_INTERNAL_URL` directly.

**Regression test idea**: grep `fetch\\(.*http` across `app/`, `components/`,
`hooks/`. Every hit should be in a server-only file.

---

## G16 — `428 PASSWORD_CHANGE_REQUIRED` loop, user cannot escape

**Symptom**: Seeded account (`admin@mantra.ai` / `demo@mantra.ai`)
logs in, dashboard is blank, Network tab shows every `/api/*` call
returning `428`. Clicking anything does nothing.

**Cause**: `middleware.BlockUntilPasswordChanged()` (backend) is doing
its job. The user must rotate through `/change-password` BEFORE any
tenant-scoped endpoint responds. Two things can break this:

1. `/change-password` page is missing or 404s.
2. The rotation form fires but the backend fails to mint + set a fresh
   JWT, so the browser keeps sending the `mcp=true` cookie.

**Fix**:
- Ensure `app/change-password/page.tsx` exists and renders the form.
- Ensure `backend/handlers/auth.go::ChangePassword` signs a new JWT,
  sets it via `c.Cookie(...)`, AND includes the `token` in the JSON
  body so the server action can also rotate the Next-side cookie.
- `middleware.ts` must decode the `mcp` claim and let `/change-password`
  through when mcp=true AND bounce OFF of `/change-password` when
  mcp=false. Both directions matter.

**Prevention**: Don't loosen `BlockUntilPasswordChanged` "just for
testing". If dev needs to skip, set `must_change_password = FALSE` on
the specific row:
```sql
UPDATE users SET must_change_password = FALSE WHERE email = 'you@dev.local';
```

---

## G17 — Tenant sees "No AI providers" even though SUPER_ADMIN configured one

**Symptom**: CLIENT_ADMIN logs in, goes to AI Hub, list is empty.
SUPER_ADMIN sees 3 providers in the same DB.

**Cause**: SUPER_ADMIN created providers with `client_id = NULL` to
share them platform-wide. The old `ScopedDB` only matched
`client_id = $scope` — NULLs were filtered out.

**Fix (Phase B already applied)**: `GetAIProviders` uses
`ScopedDBWithShared()` which emits `client_id = $scope OR client_id IS NULL`.
Mutation endpoints still use strict `ScopedDB` so a tenant can't
clobber the shared row.

**If you add a new resource type where tenants should also see shared
rows**: copy the pattern. Otherwise default to `ScopedDB` (stricter).

---

## G18 — `docker compose up` succeeds but backend logs "bootstrap skipped"

**Symptom**: Fresh VPS, first deploy, `init.sql` runs, but you never
see the `[Mantra] Bootstrapped default users` notice.

**Cause**: `init.sql` guards the bootstrap with
`IF user_count = 0 THEN ...`. If Postgres has ANY row in `users` —
even from a botched previous run — the block is skipped.

**Fix**: On a Coolify deploy where you want a clean slate:
```bash
docker compose down -v    # ⚠️ deletes postgres_data volume
docker compose up -d
```
On production where you can't wipe: insert the two users manually
from the seeds block (comments above it show the bcrypt hashes).

**Never** do this on a production DB that already has real tenants
without backing up first (`scripts/backup-postgres.sh`).

---

## G19 — Shell scripts arrive on Linux without +x bit

**Symptom**: On VPS, `./scripts/generate-env.sh --write` returns
`Permission denied` even though the file exists and `cat` works.

**Cause**: The repo is edited on a Windows workstation that doesn't
have `core.filemode = true` properly propagated. Git tracks the
file but the executable bit is missing on clone. This is a known
limitation of cross-OS git repos, not a bug.

**Fix**: First step of every fresh VPS deploy is:
```bash
chmod +x scripts/*.sh
```
This is now baked into `.agent/12-vps-deploy-runbook.md` Step 1.

**Alternative (more permanent)**: on a Linux workstation, run
`git update-index --chmod=+x scripts/*.sh && git commit -m "fix: script +x bit"`.
Once that commit is in `origin/main`, future clones inherit it. Until
that happens, keep the `chmod +x` in Step 1.

---

## G20 — `docs/schema.ts` imports drizzle-orm, breaks fresh-install builds

**Symptom**: Docker build fails in the frontend `builder` stage with
`Cannot find module 'drizzle-orm/pg-core'` pointing at
`docs/schema.ts`. Local `tsc --noEmit` on the operator's machine
passes even though Docker fails.

**Cause**: `docs/schema.ts` is a historical Drizzle-era schema
reference kept for documentation. It is NOT part of the runtime — we
migrated to Go + raw SQL in Phase A. But `tsconfig.json` originally
had `"include": ["**/*.ts", "**/*.tsx"]` with only `node_modules` in
`exclude`, so the compiler pulled in `docs/schema.ts`. On the
operator's laptop `node_modules/drizzle-orm` still existed as a leftover
from a months-old install, so the resolve succeeded and tsc passed —
masking the bug. A fresh Docker build does `pnpm install
--frozen-lockfile`, gets no drizzle (it isn't in `package.json`
anymore), and the compile fails.

**Fix** (done 2026-04-23): `tsconfig.json` now excludes `docs`,
`backend`, and `.next/dev`. The file is kept in-repo as historical
schema documentation but is invisible to the TypeScript compiler.

**Never delete `docs/schema.ts`** — it's the clearest single-file
description of the old schema shape, useful when migrating data from
a pre-Phase-A dump. If you want to keep doc files out of the build,
add them to `tsconfig.exclude`; don't delete them.

---

## G21 — `lib/env.ts` used to throw during `next build`, forcing secrets into build context

**Symptom**: Docker build dies in the `builder` stage with

```
[Mantra] FATAL: Invalid environment variables:
  • JWTSECRET: Required
```

even though `.env` exists on disk and has a valid `JWT_SECRET`.

**Cause**: `app/layout.tsx` imports `@/lib/env` for its side-effect
validation. The old validator did

```ts
if (process.env.NODE_ENV === 'production') throw new Error(...)
```

unconditionally. Next.js always runs the layout module during
`next build` (for RSC tree generation and static analysis) with
`NODE_ENV=production` auto-set — so the validator tripped on
every fresh Docker build. The "obvious" fixes are both wrong:

- Baking `JWT_SECRET` into the image via `ARG`/`ENV` leaks a secret
  into every compressed layer. Anyone who pulls the image can read it.
- Removing `JWT_SECRET` from the schema or making it optional
  defeats the entire point of the runtime validator.

**Fix** (done 2026-04-23): the validator now also checks
`process.env.NEXT_PHASE`. Next.js sets this to
`phase-production-build` only during the build; at runtime (when
`node server.js` actually boots) it is unset. So during build we
*warn* about missing server secrets (which is fine — they're read
from `process.env` at runtime, not baked into the bundle), and at
runtime we *throw* if they're missing.

**Never "solve" a build-time env-var error by weakening the schema or
passing the secret as a build ARG.** Server secrets belong in
`env_file:` at runtime, not in any layer of the Docker image.

---

## G22 — GORM AutoMigrate collides with init.sql's default constraint names

**Symptom**: Backend container crash-loops on first boot with:

```
ERROR: constraint "uni_users_email" of relation "users" does not exist (SQLSTATE 42704)
[DB] Auto-migration failed: ERROR: constraint "uni_users_email"...
```

**Cause**: `backend/database/init.sql` is Postgres's canonical schema
source. It creates `users.email TEXT NOT NULL UNIQUE`, which Postgres
names `users_email_key` (its default). `backend/models/models.go`
formerly ran `gorm.AutoMigrate(&User{}, ...)` at startup; GORM expects
unique indexes to be named `uni_users_email` (its own convention) and
issues `ALTER TABLE users DROP CONSTRAINT uni_users_email` as part of
its reconciliation. The DROP fails because that named constraint was
never created — the Postgres-default one was — and because GORM's
migrator wraps everything in one transaction, the entire AutoMigrate
rolls back, then `log.Fatalf` crashes the container. Restart policy
`unless-stopped` retries the same failure forever.

**Fix** (done 2026-04-23): `ConnectPostgres()` no longer calls
AutoMigrate. The `models.AutoMigrate` helper was deleted. Schema is
authoritative in `init.sql`, which Postgres runs once when the data
volume is first created. Go code reads and writes tables but never
tries to create or alter them.

**Workflow for adding a column or table**:

1. Add DDL to `init.sql` with `CREATE TABLE IF NOT EXISTS` or
   `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...`.
2. Add the matching Go field/struct in `models/models.go`.
3. For a fresh deploy the init.sql runs automatically. For an existing
   database, the operator runs the ALTER statements manually:
   ```bash
   docker compose exec -T postgres psql -U mantra -d mantra_db < backend/database/init.sql
   ```
   (IF NOT EXISTS makes this idempotent.)

**Never re-enable AutoMigrate** as a shortcut. Having two schema
sources of truth is the root cause; picking one (init.sql) is the fix.

---

## G23 — Evolution v2.2+ split Redis config into CACHE_REDIS_* namespace

**Symptom**: Evolution container is `Up` (not restarting) and its
HTTP server responds on :8080, but every API call returns HTTP 500
and the container log spams

```
[Redis] redis disconnected
[Redis] redis disconnected
[Redis] redis disconnected
```

several times per second. Postgres side of Evolution works fine
(migrations apply, `evolution_db` is populated).

**Cause**: Evolution v2.1 had a single `REDIS_ENABLED` /
`REDIS_URI` / `REDIS_PREFIX_KEY` config that drove both the database
layer and the cache/session layer. v2.2+ split these. The database
layer is still configured by `DATABASE_*` (which we already set —
see G-entry above), but the cache/session client now reads from a
`CACHE_REDIS_*` namespace. The legacy `REDIS_*` keys are silently
ignored by the cache client — it falls through to "no config", tries
to connect to an undefined address, fails, and retries in a tight
loop.

**Fix** (done 2026-04-23): replaced the three legacy keys with

```yaml
CACHE_REDIS_ENABLED:        "true"
CACHE_REDIS_URI:            redis://redis:6379/6
CACHE_REDIS_PREFIX_KEY:     evolution
CACHE_REDIS_TTL:            "604800"
CACHE_REDIS_SAVE_INSTANCES: "false"
CACHE_LOCAL_ENABLED:        "false"
```

The `/6` routes Evolution's traffic to Redis database index 6 so it
doesn't mingle with the main app's cache on db 0. `CACHE_LOCAL_ENABLED=false`
forces Evolution to error loudly if the Redis connection itself
fails, rather than silently falling back to an in-memory cache that
loses WhatsApp session state on container restart.

**Diagnostic tip**: any env-var documentation search for Evolution
must match the pinned image tag (`evoapicloud/evolution-api:v2.3.7`).
Docs on `atendai/evolution-api` or untagged "latest" examples online
typically reference v2.1 schema and will mislead you.

---

## G24 — Frontend login fails with "Cannot reach the server" in Docker

**Symptom**: Login page renders, but submitting credentials shows
"Cannot reach the server. Please try again." The backend health
endpoint (`/health`) returns 200 when accessed directly.

**Cause**: `serverConfig` in `lib/config.ts` was a static object
evaluated at module load time. Next.js evaluates modules during the
build phase when Docker runtime env vars (like `BACKEND_INTERNAL_URL`)
are not available. The cached object had empty strings for all env
vars, causing `callLoginAPI` to use an empty `apiUrl`.

**Fix**: Convert `serverConfig` from a static object to a function
`getServerConfig()` that reads `process.env` at call time. Update
all consumers:

- `lib/auth.ts` — `callLoginAPI()`, `getJwtSecret()`, `devAuthIssue()`
- `middleware.ts` — `getJwtSecret()`, `decodeSession()`
- `app/change-password/actions.ts` — `changePasswordAction()`

```typescript
// lib/config.ts — before (BROKEN in Docker)
export const serverConfig = typeof window === 'undefined'
  ? { backendInternalUrl: serverEnv('BACKEND_INTERNAL_URL') }
  : null

// lib/config.ts — after (works in Docker)
export function getServerConfig() {
  if (typeof window !== 'undefined') return null
  return { backendInternalUrl: serverEnv('BACKEND_INTERNAL_URL') }
}
```

**Prevention**: Never read `process.env.*` at module scope in Next.js
files that run as Server Actions. Always use a function or access
env vars inside the request handler/action.

---

## G25 — "use server" actions fail with "Cannot find module 'xyz'"

**Symptom**: Server Action throws module resolution error even though
the module is in `node_modules` and works in pages/components.

**Cause**: Next.js 14+ bundles Server Actions separately from the page
bundle. If the action imports from a file that has side-effects or
imports Node-only modules at the top level, the bundler may fail to
include dependencies correctly.

**Fix**: Keep Server Action files lean. Move shared logic to utility
files that don't import server-only modules at the top level, or
use dynamic imports inside the action function.

**Prevention**: Server Actions should only import from:
- `next/*` modules
- Database/auth utilities that are server-safe
- Schema/types (not implementation with side effects)

---

## G26 — Pre-flight deadlock: untracked operator files + script +x mode bit

**Symptom**: `scripts/hermes-check.sh` exits 1 at Step 0 with two
categories of failure that form a loop:

1. `git status --porcelain` emits `??` lines for operator-owned
   untracked files (`.env2`, `.windsurf/`, local notes). The
   pre-flight check `test -z "$(git status --porcelain)"` fails
   because the output is non-empty.

2. `scripts/*.sh` checked in at mode 0644. The runbook's Step 1
   `chmod +x scripts/*.sh` raises disk mode to 0755 but HEAD still
   says 0644, so git reports each script as ` M`. `git checkout
   HEAD -- scripts/*.sh` resets disk mode to 0644 but the NEXT
   pre-flight requires `chmod +x` again, re-dirtying the tree.

Agents correctly refuse to `rm` the untracked files (operator
owns them) or skip pre-flight (violates persona P3), and end up
stuck between options A, B, C with no clean path.

**Cause**: Two legitimate bugs, not improvisation:

- **`hermes-check.sh` conflates "untracked" with "dirty".**
  Untracked files do not block `git pull --ff-only`. The check
  should only fail on *modified tracked* files.
- **The repo doesn't store the executable bit.** On Windows
  (where much of this codebase is authored) `core.fileMode` is
  typically false and `chmod +x` is meaningless, so contributors
  never commit the `+x` bit. On Linux it is mandatory to run
  shell scripts, so Hermes has to chmod on every deploy, and
  that creates a mode-diff every time.

**Fix**:

1. In `scripts/hermes-check.sh`, change the cleanliness check to
   ignore untracked files:
   ```bash
   git status --porcelain | grep -v '^??'
   ```
   Also surface the untracked count as a WARN line so the operator
   sees the untracked files exist without being blocked by them.

2. Commit the `+x` bit for every shell script so `chmod +x` is a
   no-op on subsequent pulls:
   ```bash
   git update-index --chmod=+x scripts/*.sh
   git commit -m "chore(scripts): mark shell scripts executable in index"
   git push
   ```
   After this commit lands, `git diff` on any fresh checkout shows
   nothing even on Linux, because HEAD and disk both agree on
   mode 0755.

**Prevention**:

- Every new shell script checked in MUST be added with
  `git update-index --chmod=+x path/to/script.sh` before commit,
  so Linux agents don't have to chmod in the runbook.
- `hermes-check.sh` must continue to tolerate untracked files.
  The operator's working directory is not our authority.
- If a future pre-flight check needs to enforce "no stray test
  artifacts", add an explicit grep against known-bad patterns
  (e.g. `*.tmp`, `*.log`) rather than a blanket untracked check.
