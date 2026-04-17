# Mantra AI — Agentic WhatsApp SaaS

> Multi-tenant platform for AI-powered WhatsApp automation, built for UMKM scale.  
> **Stack:** Next.js 14 · Go Fiber · PostgreSQL 15 · Redis 7 · Evolution API  
> **Target deploy:** Debian 12 VPS via Coolify (self-hosted, full stack in one box)

---

## What it does

- **Inbox** — Live WhatsApp conversations streamed via WebSocket
- **AI Hub** — Multi-provider LLM fallback chain (OpenAI / Groq / OpenRouter)
- **WhatsApp Gateway** — Evolution API instances, QR connect, webhook ingestion
- **Tenants** — Multi-tenant isolation with per-tenant AI persona & token quota
- **Diagnosis** — Live health checks + AI-powered repair recommendations
- **RBAC** — `SUPER_ADMIN` / `CLIENT_ADMIN` / `STAFF` with middleware route protection

---

## Quick Start — Local development

```bash
# 1. Install deps
pnpm install

# 2. Bootstrap environment
cp .env.example .env
# edit .env — at minimum set JWT_SECRET, POSTGRES_PASSWORD, EVO_API_KEY

# 3. Start full stack via Docker
docker compose up -d

# 4. Open
# Frontend: http://localhost:5000
# Backend:  http://localhost:3001/health
```

Default login (change after first use):

| Role | Email | Password |
|------|-------|----------|
| `SUPER_ADMIN` | `admin@mantra.ai` | `MantraAdmin2024!` |
| `CLIENT_ADMIN` | `demo@mantra.ai` | `admin123` |

### Running frontend/backend separately (no Docker)

```bash
# Terminal A — Go backend (requires local Postgres & Redis)
cd backend && go run .

# Terminal B — Next.js frontend
pnpm dev
```

Details → [`DEVELOPMENT.md`](./DEVELOPMENT.md)

---

## Quick Start — Production (VPS + Coolify)

```bash
# On your VPS (Debian 12, 4GB RAM)
ssh root@YOUR_VPS_IP

# Install Coolify (one-liner)
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

# Then in Coolify UI:
# 1. Connect your GitHub repo
# 2. Choose "Docker Compose" build pack → uses repo docker-compose.yaml
# 3. Paste env vars from .env.example (fill all REQUIRED)
# 4. Map domains: app.domain.com → frontend:5000, api.domain.com → backend:3001
# 5. Deploy — Coolify handles SSL, Traefik reverse proxy, healthchecks
```

Full walkthrough → [`DEPLOY_COOLIFY.md`](./DEPLOY_COOLIFY.md)

---

## Documentation Map

| Audience | Start here |
|----------|-----------|
| **Just exploring** | this README |
| **Local dev / new contributor** | [`DEVELOPMENT.md`](./DEVELOPMENT.md) |
| **System understanding** | [`ARCHITECTURE.md`](./ARCHITECTURE.md) |
| **Deploying to VPS** | [`DEPLOY_COOLIFY.md`](./DEPLOY_COOLIFY.md) |
| **Backend API work** | [`docs/api-contract.md`](./docs/api-contract.md) |
| **Database work** | [`docs/database-schema.md`](./docs/database-schema.md) |
| **Product scope** | [`docs/PRD.md`](./docs/PRD.md) |
| **Autonomous AI agent** | [`AI_AGENT_BRIEF.md`](./AI_AGENT_BRIEF.md) + `CREDENTIALS.md` (gitignored) |

---

## Repository Layout

```
mantra-ui-v1/
├── app/                  Next.js 14 App Router pages
├── components/           React components (shadcn/ui)
├── hooks/                Data + session hooks
├── lib/                  api-client, config, env (Zod), auth, sanitize
├── backend/              Go Fiber API
│   ├── main.go           entry + /health + graceful shutdown
│   ├── config/           env loading & validation
│   ├── database/         postgres.go, redis.go, init.sql (DDL)
│   ├── models/           GORM models
│   ├── handlers/         HTTP handlers (auth, ai, whatsapp, inbox, …)
│   ├── middleware/       JWT auth + RBAC
│   ├── routes/           route registration
│   ├── services/         ai_fallback, evolution, memory
│   └── ws/               WebSocket hubs (inbox live, QR stream)
├── docs/                 api-contract, database-schema, PRD
├── docker-compose.yaml   Full stack orchestration
├── .env.example          All environment variables (grouped & documented)
├── ARCHITECTURE.md       System architecture reference
├── DEPLOY_COOLIFY.md     VPS + Coolify deployment guide
├── DEVELOPMENT.md        Local dev reference
├── AI_AGENT_BRIEF.md     Operational brief for autonomous agents
└── CREDENTIALS.md        (gitignored) plaintext secrets registry
```

---

## Environment Variables

All variables live in `.env.example` (grouped in 6 sections):

| Group | Prefix / Keys | Exposed to browser? |
|-------|---------------|---------------------|
| `[FRONTEND_NEXTJS]` | `NEXT_PUBLIC_*` | ✅ yes |
| `[BACKEND_GO]` | `JWT_SECRET`, `PORT`, `APP_ENV`, `FRONTEND_URL` | ❌ server only |
| `[DATABASE_POSTGRES]` | `DATABASE_URL`, `POSTGRES_*`, `REDIS_URL` | ❌ server only |
| `[WHATSAPP_PROVIDER]` | `EVO_API_URL`, `EVO_API_KEY`, `EVO_INSTANCE_NAME` | ❌ server only |
| `[AGENTIC_AI]` | `HERMES_AUTH_TOKEN`, `OPENAI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY` | ❌ server only |
| `[FEATURE_FLAGS]` | `NEXT_PUBLIC_ENABLE_DEVTOOLS`, `NEXT_PUBLIC_ENABLE_MOCK_DATA` | ✅ yes |

Access pattern (do **not** read `process.env` directly in app code):
- **Frontend server code:** import `serverConfig` from `lib/config.ts`
- **Frontend client code:** import `clientConfig` from `lib/config.ts` (only `NEXT_PUBLIC_*`)
- **Backend Go:** import `config.Load()` from `backend/config/config.go`

Validation is Zod (`lib/env.ts`) on the frontend side and explicit checks on the Go side.

---

## Security & Production Checklist

- [ ] `JWT_SECRET` regenerated (`openssl rand -base64 48`) — **not** the example value
- [ ] `POSTGRES_PASSWORD` regenerated (strong, 20+ chars)
- [ ] `HERMES_AUTH_TOKEN` regenerated
- [ ] Default admin passwords changed after first login
- [ ] `.env` is gitignored (verify: `git check-ignore .env`)
- [ ] Postgres & Redis ports bound to `127.0.0.1` (see `docker-compose.yaml`) — **not** publicly exposed
- [ ] HTTPS active on frontend + backend (Coolify / Traefik handles this)
- [ ] CORS `FRONTEND_URL` set to the exact production frontend origin
- [ ] UFW firewall restricts to `22/80/443` only
- [ ] Automated backups scheduled (`pg_dump` cron → off-box)

---

## Resource Budget

| Service | RAM | CPU |
|---------|-----|-----|
| PostgreSQL 15 | 512 MB | shared |
| Redis 7 | 256 MB | shared |
| Evolution API | 1 GB | shared |
| Go backend | 256 MB | shared |
| Next.js frontend | 256 MB | shared |
| **Total** | **~2.3 GB** | fits on 4 GB VPS |

---

## License

Proprietary — Mantra AI.
