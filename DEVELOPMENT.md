# Mantra AI — Development Reference

> Local dev / debugging / contributing guide.  
> For deployment see [`DEPLOY_COOLIFY.md`](./DEPLOY_COOLIFY.md).  
> For architecture see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | ≥ 20 | Next.js runtime |
| pnpm | ≥ 9 | Frontend package manager |
| Go | ≥ 1.22 | Backend compile |
| Docker + Compose | latest | Full-stack orchestration (recommended path) |
| PostgreSQL | 15+ | Only needed if running backend without Docker |
| Redis | 7 | Only needed if running backend without Docker |

---

## Two ways to run the dev stack

### Option A — Full Docker (recommended, closest to prod)

```bash
cp .env.example .env
# edit .env: JWT_SECRET, POSTGRES_PASSWORD, EVO_API_KEY minimum

docker compose up -d
docker compose logs -f backend frontend
```

- Frontend: http://localhost:5000
- Backend health: http://localhost:3001/health
- Postgres: localhost:5432 (bound to 127.0.0.1)
- Redis: localhost:6379 (bound to 127.0.0.1)

Stop: `docker compose down` · Fresh reset (⚠ data loss): `docker compose down -v`

### Option B — Frontend + Backend as host processes

Useful for fast iteration on either side. Postgres + Redis still run in Docker.

```bash
# Keep Postgres + Redis running
docker compose up -d postgres redis

# Terminal A — Go backend
cd backend
go mod download
go run .            # listens on :3001

# Terminal B — Next.js frontend
pnpm install
pnpm dev            # listens on :5000
```

Frontend env (`.env`) for Option B should point `NEXT_PUBLIC_API_URL=http://localhost:3001`.

---

## Default Accounts (dev only)

| Role | Email | Password | Scope |
|------|-------|----------|-------|
| `SUPER_ADMIN` | `admin@mantra.ai` | `MantraAdmin2024!` | Full access incl. `/diagnosis`, `/settings` |
| `CLIENT_ADMIN` | `demo@mantra.ai` | `admin123` | All routes except admin-only |

Seeded idempotently by `backend/database/init.sql` (only if `users` table is empty).  
**Change immediately in any shared / deployed environment.**

---

## Dev Auth Bypass

When the Go backend is unreachable and `APP_ENV=development` (or `NEXT_PUBLIC_ENABLE_MOCK_DATA=true`), `lib/auth.ts` issues a local JWT that matches the seeded credentials. This lets you hit the frontend UI without running the Go server. Real credentials are still required — the bypass only kicks in when the upstream login call fails.

Disable in production by ensuring `APP_ENV=production`.

---

## Role-Based Access

| Route | `SUPER_ADMIN` | `CLIENT_ADMIN` | `STAFF` |
|-------|:-:|:-:|:-:|
| `/` | ✅ | ✅ | ✅ |
| `/inbox` | ✅ | ✅ | ✅ (read) |
| `/whatsapp` | ✅ | ✅ | ❌ |
| `/ai-hub` | ✅ | ✅ | ✅ |
| `/tenants` | ✅ | ✅ | ✅ (read) |
| `/settings` | ✅ | ❌ | ❌ |
| `/diagnosis` | ✅ | ❌ | ❌ |

Enforcement: `proxy.ts` (middleware) validates JWT from `mantra_session` cookie using `jose` + `JWT_SECRET`, injects `x-user-role` header, and redirects on role mismatch.

---

## Auth Flow

```
Unauthenticated hit on /inbox
  → middleware redirects to /login?redirect=/inbox

POST /login
  → server action app/login/actions.ts → POST /api/auth/login (Go)
  → Go: bcrypt compare → sign JWT → return token
  → Next.js: set httpOnly cookie `mantra_session` (24h)
  → redirect to ?redirect target

Subsequent requests
  → proxy.ts verifies JWT with JOSE+JWT_SECRET
  → checks role for protected routes
  → injects x-user-role
```

---

## Backend API Quick Test

```bash
# Health
curl http://localhost:3001/health

# Login
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mantra.ai","password":"MantraAdmin2024!"}'

# /api/auth/me with cookie
curl http://localhost:3001/api/auth/me -H "Cookie: mantra_session=<token>"
```

Full API reference → [`docs/api-contract.md`](./docs/api-contract.md)

---

## Database

Schema source of truth: [`backend/database/init.sql`](./backend/database/init.sql)  
Human reference: [`docs/database-schema.md`](./docs/database-schema.md)

Quick shell:

```bash
docker compose exec postgres psql -U mantra -d mantra_db
```

Common queries:

```sql
SELECT id, email, role FROM users;
SELECT name, token_balance, is_active FROM clients;
SELECT instance_name, status FROM whatsapp_instances;
```

Reset dev DB (⚠ destroys data):

```bash
docker compose down -v
docker compose up -d
```

---

## Environment Variables (dev defaults)

Only the essentials — full list in `.env.example`:

```env
APP_ENV=development
PORT=3001
JWT_SECRET=change-me-in-production-please
DATABASE_URL=postgres://mantra:mantra@postgres:5432/mantra_db?sslmode=disable
REDIS_URL=redis://redis:6379

EVO_API_URL=http://evolution:8080
EVO_API_KEY=dev-evolution-key
EVO_INSTANCE_NAME=mantra_dev

NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_ENABLE_DEVTOOLS=true
NEXT_PUBLIC_ENABLE_MOCK_DATA=false
```

**Never** read `process.env.*` directly in app code — always via `lib/config.ts` (`serverConfig` / `clientConfig`) on the frontend, and `config.Load()` on the Go side. Adding a new variable? Update all four places: `.env.example`, `lib/env.ts` (Zod), `lib/config.ts`, and `backend/config/config.go`.

---

## Common Dev Issues

| Symptom | Fix |
|---------|-----|
| `EADDRINUSE :5000` | `netstat -ano \| findstr :5000` then kill the PID |
| `connection refused postgres` | `docker compose up -d postgres` then re-run backend |
| Login returns 401 with correct password | Bcrypt hash mismatch — re-run `init.sql` or `UPDATE users SET password=...` |
| Frontend blank screen after login | Check `JWT_SECRET` matches between `.env` (frontend) and what backend signs with |
| Hydration mismatch warning | Client-only state (Date, Math.random) — wrap with `useEffect` + `suppressHydrationWarning` |

---

## Contributing Checklist

- [ ] `pnpm lint` clean
- [ ] `pnpm typecheck` clean
- [ ] `go vet ./...` clean in `backend/`
- [ ] New env vars added to all 4 places (see above)
- [ ] No `process.env.*` outside `lib/env.ts` and `lib/config.ts`
- [ ] `ARCHITECTURE.md` updated if structural change
- [ ] `docs/api-contract.md` updated for new endpoints
- [ ] `docs/database-schema.md` updated for schema changes
