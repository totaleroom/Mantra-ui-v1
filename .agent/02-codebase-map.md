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
| `app/change-password/page.tsx` + `change-password-form.tsx` | **Phase B**: Forced rotation page. Reachable ONLY when JWT carries `mcp=true`; edge middleware enforces both directions. |
| `app/change-password/actions.ts` | **Phase B**: Server action that forwards the HttpOnly cookie to backend's `ChangePassword`, then re-sets the fresh cookie returned by the backend so the next request carries `mcp=false`. |
| `app/tenants/[id]/page.tsx` | Tenant detail + AI config. Has "Knowledge Base" & "Tools" links. |
| `app/tenants/[id]/knowledge/page.tsx` | KB dashboard (Phase 2) — Documents tab + FAQ tab, upload + CRUD. |
| `app/tenants/[id]/tools/page.tsx` | Tools management (Phase 4) — list + form, builtin vs webhook. |
| `app/error.tsx`, `global-error.tsx`, `loading.tsx`, `not-found.tsx` | Next.js boundary pages. |
| `components/dashboard/*` | Sidebar, header, layout shell, command palette trigger. |
| `components/command-palette.tsx` | Global ⌘K palette (navigate, theme, logout). |
| `components/inbox/reply-composer.tsx` | Manual WA send from dashboard. |
| `components/feedback/*` | `EmptyState`, `ErrorFallback`, `PageLoading` (reusable). |
| `components/ui/*` | shadcn/ui primitives. Rarely edit directly. |
| `hooks/use-whatsapp.ts` | Queries + mutations for instances, incl. manual send. |
| `hooks/use-session.ts` | Reads cookie on client, exposes user object. |
| `hooks/use-inbox-live.ts` | WebSocket subscriber for `/api/inbox/live`. |
| `hooks/use-tenant.ts` | Single tenant fetch + patch. |
| `hooks/use-knowledge.ts` | KB CRUD hooks (Phase 2): chunks, FAQs, stats. |
| `hooks/use-tools.ts` | Client tools CRUD hooks (Phase 4). |
| `lib/config.ts` | Reads env via Zod (`env.ts`), exports `serverConfig` / `clientConfig`. |
| `lib/env.ts` | Zod schemas for env vars. Server + client. |
| `lib/auth.ts` | JWT verify + dev-bypass JWT issuer. |
| `lib/api-client.ts` | Fetch wrapper. **Phase B**: always relative-path / same-origin; Next.js `rewrites()` forwards `/api/*` to backend. Auto-redirects to `/change-password` on any 428 response. |

## Backend (`backend/`)

| Path | Purpose |
|------|---------|
| `main.go` | Entry. Sets up Fiber, DB, Redis, WS hubs, orchestrator wiring. |
| `config/config.go` | Env loading + validation. Add new env vars here. |
| `database/postgres.go`, `redis.go` | Connection setup. |
| `database/init.sql` | DDL + seed. Runs on first boot. Includes `pgvector` extension + 11 tables. |
| `models/models.go` | Core GORM models: User, Client, WhatsAppInstance, InboxMessage, AIProvider, ClientAIConfig, CustomerMemory, SystemDiagnosis. `AutoMigrate` registry. |
| `models/knowledge.go` | **Phase 2**: `KnowledgeChunk` (vector column), `FAQ`, `JSONB` type alias, `KnowledgeStats`. |
| `models/tool.go` | **Phase 4**: `ClientTool` + `HandlerType*` constants. |
| `handlers/auth.go` | Login, register, logout, refresh. bcrypt cost 12. |
| `handlers/ai.go` | AI providers CRUD + test endpoint. |
| `handlers/whatsapp.go` | Instance CRUD, QR fetch, disconnect, status, **manual send**. |
| `handlers/inbox.go` | List messages (filtered), stats. |
| `handlers/webhooks.go` | **Evolution webhook receiver** (secret auth). |
| `handlers/clients.go` | Tenant CRUD + AI config. |
| `handlers/diagnosis.go` | Health snapshot for dashboard. |
| `handlers/knowledge.go` | **Phase 2**: KB chunks + FAQs CRUD, stats. Uses `clientIDParam` helper. |
| `handlers/tools.go` | **Phase 4**: ClientTool CRUD with strict validation (snake_case names, URL prefix check). |
| `handlers/tenant_scope.go` | **Phase A**: central tenant-isolation helpers. `EffectiveTenantScope()` returns the `*uint` that must be applied to queries. `ScopedDB()` appends `WHERE client_id = ?`. `ScopedDBWithShared()` also surfaces `IS NULL` (for read-shared resources). `CanMutateClientResource()` is the "can this principal write to row X?" gate. |
| `handlers/system.go` | `GetSystemHealth` (service pings) + `RunDiagnosis`. SUPER_ADMIN-only. |
| `handlers/preflight.go` | **Phase B**: `GET /api/system/preflight`. The "blackbox" — a comprehensive machine+human report (infra, config, bootstrap, security, runtime) with remediation hints per check. Returns 503 when overall=fail so Coolify / uptime monitors alert. |
| `boot_banner.go` (main pkg) | **Phase B**: pretty-printed startup checklist in backend logs. In production mode, any fatal line causes `log.Fatal` so a misconfigured container never advertises itself as healthy. |
| `middleware/auth.go` | JWT validate + RBAC + **Phase A** `BlockUntilPasswordChanged()` that 428s any caller still flagged for rotation. |
| `middleware/rate_limit.go` | **Phase A**: in-memory token-bucket rate limiter. `NewAuthLimiter()` (10/min/IP on /api/auth/*), `NewPrincipalLimiter()` (60/min/userID) applied to the rest. |
| `routes/routes.go` | Route registration. Add new endpoints here. Chain: `JWTProtected → allowlist(change-pw, logout) → BlockUntilPasswordChanged → tenant routes`. |
| `services/evolution.go` | HTTP client to Evolution API. `SendText`, `SetWebhook`, `GetQR`, etc. |
| `services/ai_fallback.go` | Priority-ordered provider chain. `Chat()` + `ChatWithTools()` (Phase 4). Defines `ChatMessage`, `ToolCall`, `ToolDefinition`. |
| `services/embedding.go` | **Phase 2**: OpenAI-compat embedding client with fallback chain. |
| `services/memory.go` | CustomerMemory cache (Redis + Postgres fallback). |
| `services/retrieval.go` | **Phase 3**: RAG retrieval — FAQ keyword match + pgvector ANN. Returns `RetrievedContext{Blob, FAQIDs, ChunkIDs, Provider}`. |
| `services/tools.go` | **Phase 4**: `ToolService` — loads per-tenant tools, executes builtin (registry of Go funcs) or webhook (POST to tenant URL). SSRF-mitigated. |
| `services/orchestrator.go` | **Core AI pipeline.** `HandleInbound`, `SendManual`, `buildConversation` (with RAG), `runReplyLoop` (tool calling, max 3 iterations). |
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
| Change RAG retrieval logic | `backend/services/retrieval.go::Retrieve` |
| Add a new builtin tool | `backend/services/tools.go::builtinRegistry` map |
| Add a new DB table | `backend/database/init.sql` + `backend/models/<file>.go` + register in `models/models.go::AutoMigrate` + update `docs/database-schema.md` + `docs/schema.ts` |
| Add a dashboard page | `app/<route>/page.tsx` — use `DashboardLayout` from `components/dashboard` |
| Hook React Query | `hooks/use-*.ts` — copy pattern from `use-whatsapp.ts` |
| Broadcast to inbox UI | Call `handlers.Orchestrator.onMessagePersisted(msg)` indirectly by persisting — the wiring in `main.go` handles the rest |
| Touch auth cookie | `backend/handlers/auth.go` — maxAge must match JWT exp (28800 s) |
| Change CSP | `next.config.mjs::headers()` |
| Change the Next → backend rewrite | `next.config.mjs::rewrites()` — `/api/:path*` goes to `BACKEND_INTERNAL_URL` |
| Add a slash command to palette | `components/command-palette.tsx::commands` array |
| Enforce password rotation on new users | Set `must_change_password = TRUE` on the DB row; middleware + frontend handle the rest |
| Make a resource "shared across tenants" | Insert row with `client_id IS NULL`, use `ScopedDBWithShared()` in the list handler |
| Forbid tenant from reading other tenants' data | Wrap every GORM `.Where()` path in `handlers.ScopedDB()` — do NOT read `c.Locals("clientID")` directly |

## Deploy / ops files (Phase B additions)

| Path | Purpose |
|------|---------|
| `DEPLOY_COOLIFY.md` | Canonical end-to-end Coolify deploy guide. This is the ONE deploy doc Hermes should follow. |
| `scripts/generate-env.sh` | `openssl`-driven `.env` generator. Run once; accepts `--public-url`, `--evo-key`, `--write`. |
| `scripts/hermes-check.sh` | Hermes pre-flight. Runs at start of every Hermes session. Exits non-zero → Hermes stops and reports. |
| `scripts/backup-postgres.sh` | Daily cron script. Drop into `/etc/cron.daily/` on the VPS. |
| `.agent/08-hermes-handoff.md` | Hermes operating envelope (what it may / must-ask / may-not do). |
| `.agent/07-task-log.md` | Hermes reads the top entry on every pull to know what the previous agent changed. Append-only. |
