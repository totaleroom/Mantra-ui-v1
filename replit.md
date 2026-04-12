# Mantra AI - Full Stack Application

## Project Overview

Mantra AI is an enterprise AI-powered customer service platform. It consists of:
- **Frontend**: Next.js 16 app (root directory) — dashboard, inbox, WhatsApp gateway, AI hub, tenants, diagnosis
- **Backend**: Go Fiber API (`backend/`) — REST API, WebSockets, AI provider fallback, Evolution API bridge, Redis memory

## Architecture

```
/                          → Next.js 16 frontend (port 5000 in dev)
/backend                   → Go Fiber backend (port 3001)
/docs                      → API contract, schema, handover docs
/components                → React UI components (shadcn/ui)
/hooks                     → Custom React hooks for API calls
/lib                       → API client, types, utilities
/app                       → Next.js App Router pages
/docker-compose.yaml       → Production full-stack orchestration
/.env.production.example   → Template for production secrets
```

## Workflows

| Workflow | Command | Port | Purpose |
|----------|---------|------|---------|
| Start application | `pnpm run dev` | 5000 | Next.js frontend dev server |
| Start Backend | `cd backend && go run .` | 3001 | Go Fiber API server |

## Backend Structure (`backend/`)

```
backend/
├── main.go                  # Entry point, Fiber setup, /health, graceful shutdown
├── config/config.go         # Env vars: PORT, DATABASE_URL, REDIS_URL, FRONTEND_URL, etc.
├── database/
│   ├── postgres.go          # GORM + PostgreSQL connection, auto-migrate
│   ├── redis.go             # Redis client (graceful fallback if unavailable)
│   └── init.sql             # Full DDL for all 8 tables (use on fresh VPS DB)
├── models/models.go         # All GORM models (User, Client, AIProvider, etc.)
├── middleware/auth.go       # JWT authentication middleware + RBAC roles
├── handlers/
│   ├── auth.go              # POST /api/auth/login, /register, /logout, /me
│   ├── ai_providers.go      # CRUD + priority reorder + test + model listing
│   ├── clients.go           # Tenant CRUD + AI config per client
│   ├── whatsapp.go          # Instance CRUD, connect/disconnect, status
│   ├── inbox.go             # Messages list (with filters) + stats
│   └── system.go            # /api/system/health + /api/system/diagnose
├── services/
│   ├── ai_fallback.go       # AI provider rotation by priority (Groq→OpenRouter→OpenAI)
│   ├── evolution.go         # Evolution API HTTP client (WhatsApp bridge)
│   └── memory.go            # Redis + Postgres customer memory (4-day TTL)
├── routes/routes.go         # All 30+ route registrations (REST + WebSocket)
├── ws/
│   ├── inbox_ws.go          # WebSocket hub: /api/inbox/live
│   └── qr_ws.go             # WebSocket: /api/whatsapp/instances/:name/qr
├── Dockerfile               # Multi-stage: golang:1.22-alpine → alpine:latest
├── docker-compose.yml       # Dev docker-compose (kept for reference)
└── .env.example             # Backend environment variable template
```

## Health Check

`GET /health` — Returns 200 OK only when both PostgreSQL and Redis are connected.

```json
{ "status": "ok", "db": "connected", "redis": "connected", "service": "mantra-backend" }
```

Returns 503 with `"status": "degraded"` if either service is unavailable. Coolify uses this endpoint to monitor the app.

## Production Deployment (Coolify on VPS)

### Files ready for deployment:
| File | Purpose |
|------|---------|
| `docker-compose.yaml` | Root-level production orchestration |
| `backend/Dockerfile` | Multi-stage build (golang:1.22-alpine → alpine:latest) |
| `backend/database/init.sql` | Full DDL — mount as `initdb` on first run |
| `.env.production.example` | Template for all production secrets |

### Memory Limits (Total: 2048 MB < 2.6 GB PRD budget)
| Service | Limit |
|---------|-------|
| PostgreSQL 15 | 512 MB |
| Redis 7 | 256 MB |
| Evolution API | 1 GB |
| Go Backend | 256 MB |

### Required Environment Variables (in Coolify)
| Variable | Description |
|----------|-------------|
| `POSTGRES_PASSWORD` | Secure DB password |
| `JWT_SECRET` | 64-char random string for JWT signing |
| `FRONTEND_URL` | Exact Vercel URL (e.g. `https://your-app.vercel.app`) |
| `EVOLUTION_API_KEY` | Secure Evolution API key |

## CORS Policy

CORS is controlled by the `FRONTEND_URL` environment variable. In production, only the Vercel frontend URL is allowed. Vercel preview deployments (`*.vercel.app`) are automatically added if the URL ends in `.vercel.app`.

## API Endpoints

- `GET /health` — Production health check (DB + Redis status)
- `GET/POST /api/auth/*` — Authentication
- `GET/POST/PATCH/DELETE /api/ai-providers/*` — AI provider management
- `GET/POST/DELETE /api/whatsapp/instances/*` — WhatsApp instances
- `GET /api/inbox/messages` + `GET /api/inbox/stats` — Inbox
- `GET/POST/PATCH/DELETE /api/clients/*` — Tenant management
- `GET /api/system/health` + `POST /api/system/diagnose` — System health
- `WS /api/inbox/live` — Real-time inbox
- `WS /api/whatsapp/instances/:name/qr` — QR code stream
