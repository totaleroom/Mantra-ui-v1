# 02 — Codebase Map

> When you think "where does X live?", check here first.

## Top-level layout

```
mantra-ui-v1/
├── app/                  ← Next.js 16 App Router (frontend pages + API routes)
├── components/           ← React components (shadcn/ui + custom)
├── hooks/                ← React Query hooks, session, WebSocket clients
├── lib/                  ← api-client, config, env (Zod), auth, sanitize
├── middleware.ts         ← Next.js edge middleware (route protection)
├── backend/              ← Go Fiber API (the real business logic)
├── docs/                 ← api-contract.md, database-schema.md, PRD.md
├── .agent/               ← YOU ARE HERE
├── docker-compose.yaml   ← Full stack orchestration (dev + prod)
├── .env.example          ← Env var template, 6 grouped sections
├── next.config.mjs       ← Frontend build + CSP + Server Actions allowlist
└── package.json          ← Frontend deps, scripts
```

## Frontend (`app/`, `components/`, `hooks/`, `lib/`)

| Path | Purpose |
|------|---------|
| `app/layout.tsx` | Root. Mounts `ThemeProvider`, `QueryClientProvider`, `Toaster`. |
| `app/login/page.tsx` + `login-form.tsx` | Login. Uses `useActionState` + Server Action `actions.ts`. |
| `app/login/actions.ts` | Server action. Calls backend `/api/auth/login` OR dev-bypass. |
| `app/(dashboard routes)/*` | Overview, AI Hub, WhatsApp, Inbox, Tenants, Settings, Diagnosis. Protected by `middleware.ts`. |
| `app/inbox/page.tsx` | Live inbox. Mounts `ReplyComposer` + `ThoughtProcessPanel`. |
| `app/api/auth/logout/route.ts` | Clears cookie, proxies backend logout. |
| `app/api/whatsapp/providers/route.ts` | Server-side proxy to backend (hides internal URL). |
| `app/error.tsx`, `global-error.tsx`, `loading.tsx`, `not-found.tsx` | Next.js boundary pages. |
| `components/dashboard/*` | Sidebar, header, layout shell, command palette trigger. |
| `components/command-palette.tsx` | Global ⌘K palette (navigate, theme, logout). |
| `components/inbox/reply-composer.tsx` | Manual WA send from dashboard. |
| `components/feedback/*` | `EmptyState`, `ErrorFallback`, `PageLoading` (reusable). |
| `components/ui/*` | shadcn/ui primitives. Rarely edit directly. |
| `hooks/use-whatsapp.ts` | Queries + mutations for instances, incl. manual send. |
| `hooks/use-session.ts` | Reads cookie on client, exposes user object. |
| `hooks/use-inbox-live.ts` | WebSocket subscriber for `/api/inbox/live`. |
| `lib/config.ts` | Reads env via Zod (`env.ts`), exports `serverConfig` / `clientConfig`. |
| `lib/env.ts` | Zod schemas for env vars. Server + client. |
| `lib/auth.ts` | JWT verify + dev-bypass JWT issuer. |
| `lib/api-client.ts` | Fetch wrapper with credentials + error normalization. |

## Backend (`backend/`)

| Path | Purpose |
|------|---------|
| `main.go` | Entry. Sets up Fiber, DB, Redis, WS hubs, orchestrator wiring. |
| `config/config.go` | Env loading + validation. Add new env vars here. |
| `database/postgres.go`, `redis.go` | Connection setup. |
| `database/init.sql` | DDL + seed. Runs on first boot. |
| `models/*.go` | GORM models: User, Client, WhatsAppInstance, InboxMessage, AIProvider, ClientAIConfig, CustomerMemory, AuditLog. |
| `handlers/auth.go` | Login, register, logout, refresh. bcrypt cost 12. |
| `handlers/ai.go` | AI providers CRUD + test endpoint. |
| `handlers/whatsapp.go` | Instance CRUD, QR fetch, disconnect, status, **manual send**. |
| `handlers/inbox.go` | List messages (filtered), stats. |
| `handlers/webhooks.go` | **Evolution webhook receiver** (secret auth). |
| `handlers/clients.go` | Tenant CRUD + AI config. |
| `handlers/diagnosis.go` | Health snapshot for dashboard. |
| `middleware/auth.go` | JWT validate + RBAC. |
| `routes/routes.go` | Route registration. Add new endpoints here. |
| `services/evolution.go` | HTTP client to Evolution API. `SendText`, `SetWebhook`, `GetQR`, etc. |
| `services/ai_fallback.go` | Priority-ordered provider chain. `Chat()` entry point. |
| `services/memory.go` | CustomerMemory cache (Redis + Postgres fallback). |
| `services/orchestrator.go` | **Core AI pipeline.** `HandleInbound`, `SendManual`. |
| `ws/inbox_ws.go` | Inbox WebSocket hub (live messages). |
| `ws/qr_ws.go` | QR streaming WebSocket. |
| `Dockerfile` | Multi-stage build. Uses `golang:1.25-alpine`. |

## What lives where (reverse index)

| I need to... | Go here |
|--------------|---------|
| Add a new API endpoint | `backend/handlers/` + register in `backend/routes/routes.go` |
| Add a new env var | `backend/config/config.go` **and** `lib/env.ts` + `.env.example` |
| Change AI prompt logic | `backend/services/orchestrator.go::buildConversation` |
| Add a new AI provider | `backend/services/ai_fallback.go` + DB row in `ai_providers` |
| Add a dashboard page | `app/<route>/page.tsx` — use `DashboardLayout` from `components/dashboard` |
| Hook React Query | `hooks/use-*.ts` — copy pattern from `use-whatsapp.ts` |
| Broadcast to inbox UI | Call `handlers.Orchestrator.onMessagePersisted(msg)` indirectly by persisting — the wiring in `main.go` handles the rest |
| Touch auth cookie | `backend/handlers/auth.go` — maxAge must match JWT exp (28800 s) |
| Change CSP | `next.config.mjs::headers()` |
| Add slash command to palette | `components/command-palette.tsx::commands` array |
