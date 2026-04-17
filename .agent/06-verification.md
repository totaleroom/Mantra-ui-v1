# 06 — Verification Rituals

> Before you tell the user "done", run at least one block from here.
> Do not claim success without proof.

## Block A — Frontend only (always runs)

```powershell
# From repo root
npx tsc --noEmit
# Expect: exit 0, no output

npx next build
# Expect: "✓ Compiled successfully", 13 routes listed
```

Failure modes:
- `Type error: ...` → fix the type; never add `any` silently.
- `Module not found` → check imports; see G5.
- Build succeeds but page crashes at runtime → add a regression test or at
  least a todo entry documenting it.

## Block B — Backend only (when Go code changed)

```powershell
# Requires Docker OR local Go 1.25
docker run --rm -v "${PWD}:/src" -w /src/backend golang:1.25-alpine `
  sh -c "go mod tidy && go vet ./... && go build ./..."
# Expect: exit 0

# If Docker is down and user has local Go:
cd backend; go mod tidy; go vet ./...; go build ./...
```

If neither is available, **say so to the user**. Do not claim Go changes
work without compiling them. Fall back to **manual cross-reference grep**:
look for every function signature you added/changed, grep for callers,
verify argument counts and types match. Report this in your summary.

## Block C — Full stack smoke (when both changed)

```powershell
docker compose up -d --build
Start-Sleep -Seconds 30   # let everything settle
curl http://localhost:3001/health    # expect JSON with db/redis ok
curl http://localhost:5000           # expect HTML 200
docker compose logs --tail=50 backend | Select-String -NotMatch "WARN"
```

No ERROR lines in backend logs = passing.

## Block D — End-to-end messaging (only when user asks for full validation)

Follow the 7-step smoke test in `README.md` § Post-deploy Smoke Test.

This is **the** acceptance test for the MVP. It proves the full pipeline.

## Block E — Auth invariants

When touching auth:

```powershell
# 1. Login returns cookie
curl -c cookies.txt -X POST http://localhost:3001/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"admin@mantra.ai","password":"MantraAdmin2024!"}' -v
# Check: Set-Cookie with HttpOnly, Max-Age=28800

# 2. Protected route requires cookie
curl http://localhost:3001/api/clients         # expect 401
curl -b cookies.txt http://localhost:3001/api/clients  # expect 200

# 3. Logout clears cookie
curl -b cookies.txt -X POST http://localhost:3001/api/auth/logout
# Check: Set-Cookie with Max-Age=0
```

## Block F — DB integrity (when schema or migrations touched)

```powershell
docker compose exec postgres psql -U mantra -d mantra -c "\dt"
# Should list: users, clients, whatsapp_instances, inbox_messages,
#              ai_providers, client_ai_configs, customer_memories,
#              audit_logs

docker compose exec postgres psql -U mantra -d mantra -c `
  "SELECT table_name, count(*) FROM information_schema.columns
   WHERE table_schema='public' GROUP BY table_name;"
```

Any missing table → `init.sql` didn't run cleanly. Check logs.

## Block G — Lint (rarely needed, but good to keep green)

Next.js ESLint is disabled in `next.config.mjs` (`eslint.ignoreDuringBuilds`).
If you re-enable it for a cleanup pass:

```powershell
npx next lint --fix
```

## Smoke test I can actually run right now

The reality is: most of the time Docker is not running on the user's Windows
laptop. You will only have Block A available. **Be honest about this in your
summary.** Say:

> "Verified Block A (tsc + next build clean). Block B (Go compile) skipped
> because Docker Desktop is not running. I manually cross-referenced the Go
> changes against their call sites — see summary. Run `docker compose up -d`
> before production deploy to confirm."

Users appreciate honesty about verification scope more than false confidence.
