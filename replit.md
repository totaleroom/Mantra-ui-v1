# Mantra AI - Full Stack Application

## Project Overview

Mantra AI is an enterprise AI-powered customer service platform. It consists of:
- **Frontend**: Next.js 16 app (root directory) — dashboard, inbox, WhatsApp gateway, AI hub, tenants, diagnosis
- **Backend**: Go Fiber API (backend/) — REST API, WebSockets, AI provider fallback, Evolution API bridge, Redis memory

## Architecture

```
/                     → Next.js 16 frontend (port 5000 in dev)
/backend              → Go Fiber backend (port 3001)
/docs                 → API contract, schema, handover docs
/components           → React UI components (shadcn/ui)
/hooks                → Custom React hooks for API calls
/lib                  → API client, types, utilities
/app                  → Next.js App Router pages
```

## Workflows

| Workflow | Command | Port | Purpose |
|----------|---------|------|---------|
| Start application | `pnpm run dev` | 5000 | Next.js frontend dev server |
| Start Backend | `cd backend && go run .` | 3001 | Go Fiber API server |

## Backend Structure (backend/)

```
backend/
├── main.go              # Entry point, Fiber setup, graceful shutdown
├── config/config.go     # Environment variable loading
├── database/
│   ├── postgres.go      # GORM + PostgreSQL connection, auto-migrate
│   └── redis.go         # Redis client (optional, graceful fallback)
├── models/models.go     # All GORM models (User, Client, AIProvider, etc.)
├── middleware/auth.go   # JWT authentication middleware, RBAC
├── handlers/
│   ├── auth.go          # POST /api/auth/login, /register, /logout, /me
│   ├── ai_providers.go  # CRUD + priority + test + models
│   ├── clients.go       # CRUD + AI config per client
│   ├── whatsapp.go      # Instance CRUD, connect/disconnect, status
│   ├── inbox.go         # Messages list + stats
│   └── system.go        # Health check + AI diagnosis
├── services/
│   ├── ai_fallback.go   # AI provider rotation by priority
│   ├── evolution.go     # Evolution API HTTP client (WhatsApp)
│   └── memory.go        # Redis customer memory with 4-day TTL
├── routes/routes.go     # All route registration
├── ws/
│   ├── inbox_ws.go      # WebSocket hub for /api/inbox/live
│   └── qr_ws.go         # WebSocket for /api/whatsapp/instances/:name/qr
├── Dockerfile           # Production Docker image
├── docker-compose.yml   # Full stack: postgres, redis, evolution, backend
└── .env.example         # Environment variable template
```

## Backend Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | API port (default: 3001) |
| `DATABASE_URL` | Yes (prod) | PostgreSQL connection string |
| `REDIS_URL` | No | Redis URL (default: redis://localhost:6379) |
| `JWT_SECRET` | Yes | JWT signing secret |
| `CORS_ORIGINS` | Yes (prod) | Comma-separated allowed origins |
| `EVOLUTION_API_URL` | Yes (prod) | Evolution API base URL |
| `EVOLUTION_API_KEY` | Yes (prod) | Evolution API key |

## Frontend Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend URL (e.g., https://api.yourdomain.com) |
| `NEXT_PUBLIC_WS_URL` | WebSocket URL (e.g., wss://api.yourdomain.com) |

## API Endpoints Summary

- `GET/POST /api/auth/*` — Authentication (login, register, logout, me)
- `GET/POST/PATCH/DELETE /api/ai-providers/*` — AI provider management
- `GET/POST/DELETE /api/whatsapp/instances/*` — WhatsApp instance management
- `GET /api/inbox/messages` + `GET /api/inbox/stats` — Inbox REST
- `GET /api/clients/*` — Client (tenant) CRUD + AI config
- `GET /api/system/health` + `POST /api/system/diagnose` — System health
- `WS /api/inbox/live` — Real-time inbox feed
- `WS /api/whatsapp/instances/:name/qr` — QR code stream

## Database Models

Users, Clients (tenants), AIProviders, ClientAIConfigs, WhatsAppInstances, CustomerMemories, SystemDiagnosis, InboxMessages

## Deployment

For VPS production deployment, see `backend/docker-compose.yml`. Requires Docker + Docker Compose.

Stack: PostgreSQL 16, Redis 7, Evolution API (atendai/evolution-api), Go Fiber backend.

Use a Cloudflare Tunnel to expose the backend at `api.yourdomain.com` with WebSocket support enabled.
