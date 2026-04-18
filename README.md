# Mantra AI — Agentic WhatsApp SaaS

> Multi-tenant platform for AI-powered WhatsApp automation, built for UMKM scale.  
> **Stack:** Next.js 16 · Go Fiber · PostgreSQL 15 + pgvector · Redis 7 · Evolution API  
> **Target deploy:** Debian 12 VPS via Coolify (self-hosted, full stack in one box)  
> **Status:** Phases 0–4 shipped (baseline + Knowledge Base + RAG + Tool Calling). See `.agent/10-commercial-mvp-roadmap.md`.

---

## What it does

- **Inbox** — Live WhatsApp conversations streamed via WebSocket, with manual reply composer
- **AI Hub** — Multi-provider LLM fallback chain (OpenAI / Groq / OpenRouter)
- **WhatsApp Gateway** — Evolution API instances, QR connect, webhook ingestion
- **Auto-reply** — Inbound message → client system prompt + memory → **RAG retrieval** → **AI tool loop** → outbound WhatsApp reply, all persisted + streamed live to the dashboard
- **Knowledge Base (Phase 2)** — Per-tenant document chunks (pgvector 1536-dim) + structured FAQs with tags/keywords. Upload via dashboard, auto-embedded, semantic-searched per inbound message.
- **Tool Calling (Phase 4)** — Per-tenant function registry the AI can invoke mid-conversation. Builtin handlers (Go funcs) or **webhook tools** (tenant HTTP endpoint). Max 3 iterations per message, audit-logged.
- **Tenants** — Multi-tenant isolation with per-tenant AI persona & token quota
- **Diagnosis** — Live health checks + AI-powered repair recommendations
- **RBAC** — `SUPER_ADMIN` / `CLIENT_ADMIN` / `STAFF` with middleware route protection
- **Command palette** — `⌘K` / `Ctrl+K` to navigate, switch theme, sign out

---

## Message Flow (how auto-reply actually works)

```
Customer phone
    │ 1. sends "Halo" to the tenant's WhatsApp number
    ▼
Evolution API
    │ 2. POST {PUBLIC_BACKEND_URL}/api/webhooks/evolution
    │    with X-Webhook-Secret header
    ▼
backend/handlers/webhooks.go · EvolutionWebhook
    │ 3. Validates secret, parses MESSAGES_UPSERT,
    │    skips echoes/media, extracts text + E.164 number,
    │    hands off to orchestrator in a goroutine, returns 200
    ▼
backend/services/orchestrator.go · HandleInbound
    │ 4. Resolves instance → client, enforces active/token gates,
    │    idempotency guard on provider msg ID
    │ 5. Persists inbound InboxMessage (→ WebSocket broadcast)
    │ 6. Loads ClientAIConfig + CustomerMemory (last 10 turns)
    │ 7. buildConversation — runs **RAG retrieval** (Phase 3):
    │     FAQ keyword match + top-K pgvector ANN → [KNOWLEDGE] block
    │     appended to system prompt
    │ 8. runReplyLoop — **tool-calling loop** (Phase 4, ≤ 3 iters):
    │     ChatWithTools → dispatch tool_calls via ToolService →
    │     builtin Go func OR webhook POST → feed result back → repeat
    │ 9. EvolutionService.SendText → actual WhatsApp reply
    │10. Persists outbound InboxMessage with audit JSON in
    │    ai_thought_process (retrievedFaqs, retrievedChunks, toolCalls)
    │    → WebSocket broadcast
    │11. Upserts CustomerMemory with new turn, bumps token counter
    ▼
Dashboard
   Inbox page renders both messages live via /api/inbox/live WS.
   ThoughtProcessPanel shows the audit JSON (what the AI retrieved +
   which tools it called).
```

Manual reply flow: dashboard `ReplyComposer` → `POST /api/whatsapp/instances/:id/send` →
`Orchestrator.SendManual` → `SendText` → persist outbound → broadcast.

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
| **System understanding** | [`ARCHITECTURE.md`](./ARCHITECTURE.md) (post-Phase-4, includes RAG + tool flow) |
| **Deploying to VPS** | [`DEPLOY_COOLIFY.md`](./DEPLOY_COOLIFY.md) (generic) · [`.agent/09-single-user-deployment.md`](./.agent/09-single-user-deployment.md) (Tailscale private) |
| **Post-deploy verification** | [`.agent/11-phase-2-4-deploy-smoke-test.md`](./.agent/11-phase-2-4-deploy-smoke-test.md) — 9-step runbook |
| **Backend API work** | [`docs/api-contract.md`](./docs/api-contract.md) |
| **Database work** | [`docs/database-schema.md`](./docs/database-schema.md) |
| **Product scope & roadmap** | [`docs/PRD.md`](./docs/PRD.md) · [`.agent/10-commercial-mvp-roadmap.md`](./.agent/10-commercial-mvp-roadmap.md) |
| **AI agent picking up from GitHub** | **[`.agent/00-START-HERE.md`](./.agent/00-START-HERE.md)** ← read first · then [`.agent/README.md`](./.agent/README.md) (skill pack) · [`AI_AGENT_BRIEF.md`](./AI_AGENT_BRIEF.md) (TL;DR) · `CREDENTIALS.md` (gitignored, only if deploying) |

---

## Repository Layout

```
mantra-ui-v1/
├── .agent/               AI skill pack — any agent continuing this project reads 00-START-HERE.md first
├── app/                  Next.js 16 App Router pages
│   └── tenants/[id]/     tenant detail + knowledge/  +  tools/  sub-pages (Phase 2 + 4 UI)
├── components/           React components (shadcn/ui, inbox, dashboard shell)
├── hooks/                use-whatsapp, use-inbox-live, use-knowledge (Phase 2), use-tools (Phase 4), …
├── lib/                  api-client, config, env (Zod), auth, sanitize
├── backend/              Go Fiber API
│   ├── main.go           entry + /health + graceful shutdown
│   ├── config/           env loading & validation
│   ├── database/         postgres.go, redis.go, init.sql (11-table DDL incl. pgvector)
│   ├── models/           models.go + knowledge.go (Phase 2) + tool.go (Phase 4), all GORM
│   ├── handlers/         auth, ai, whatsapp, inbox, clients, knowledge (Phase 2), tools (Phase 4), …
│   ├── middleware/       JWT auth + RBAC
│   ├── routes/           route registration
│   ├── services/         ai_fallback (+ ChatWithTools), evolution, memory,
│   │                     embedding (Phase 2), retrieval (Phase 3), tools (Phase 4),
│   │                     orchestrator (runReplyLoop for tool calling)
│   └── ws/               WebSocket hubs (inbox live, QR stream)
├── docs/                 api-contract, database-schema, schema.ts (Drizzle), PRD
├── docker-compose.yaml   Full stack orchestration (uses pgvector/pgvector:pg15)
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
| `[WHATSAPP_PROVIDER]` | `EVO_API_URL`, `EVO_API_KEY`, `EVO_INSTANCE_NAME`, `PUBLIC_BACKEND_URL`, `WEBHOOK_SECRET` | ❌ server only |
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

## Post-deploy Smoke Test (first-time sanity check)

Run this **once** after your first deploy to prove every layer of the
auto-reply pipeline actually works. Each step has a clear failure signature
so you know exactly which component to look at if something breaks.

> **Verifying Phase 2–4 features specifically?** Use the dedicated 9-step
> runbook at [`.agent/11-phase-2-4-deploy-smoke-test.md`](./.agent/11-phase-2-4-deploy-smoke-test.md)
> — covers pgvector extension, KB upload, FAQ creation, RAG in the
> orchestrator, webhook tool, builtin tool, and sign-off checklist.

```bash
# 1. Backend reachable + DB + Redis healthy
curl -sSf https://api.yourdomain.com/health | jq
# Expect: {"status":"ok","db":"connected","redis":"connected", ...}

# 2. Login → cookie set
curl -sS -c cookies.txt -X POST https://api.yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mantra.ai","password":"MantraAdmin2024!"}'

# 3. Create a tenant (save the returned id)
curl -sS -b cookies.txt -X POST https://api.yourdomain.com/api/clients \
  -H "Content-Type: application/json" \
  -d '{"name":"Smoke Test Tenant","tokenLimit":1000}'

# 4. Create an AI config for that tenant (use tenant id from step 3)
curl -sS -b cookies.txt -X PUT \
  https://api.yourdomain.com/api/clients/1/ai-config \
  -H "Content-Type: application/json" \
  -d '{"modelId":"gpt-3.5-turbo","systemPrompt":"You are a friendly CS bot for a bakery.","temperature":0.7,"memoryTtlDays":4}'

# 5. Create a WhatsApp instance — Evolution will auto-register our webhook
curl -sS -b cookies.txt -X POST \
  https://api.yourdomain.com/api/whatsapp/instances \
  -H "Content-Type: application/json" \
  -d '{"instanceName":"smoke-test","clientId":1}'

# 6. Connect via QR — open the dashboard /whatsapp page, scan with
#    a real phone. Status should flip to CONNECTED within 30s.

# 7. From a DIFFERENT phone, send "Halo" to the connected number.
#    Watch these three things concurrently:
#    - backend logs: "[Webhook] ... accepted" then orchestrator logs
#    - dashboard Inbox page: inbound + outbound messages appear live
#    - sender's phone: receives an AI-generated reply within seconds
```

If step 7 doesn't produce a reply:

| Symptom | Likely cause | Where to look |
|---------|--------------|---------------|
| No webhook log at all | Evolution can't reach `PUBLIC_BACKEND_URL` | `docker compose logs evolution`, verify DNS + network |
| `invalid webhook secret` in logs | `WEBHOOK_SECRET` mismatch between backend & Evolution | `docker compose exec evolution env \| grep -i webhook` |
| Webhook received, no AI call | No `ClientAIConfig` row for this client | repeat step 4 |
| `all providers failed` | No `AIProvider` rows active, or wrong API key | dashboard AI Hub page |
| Reply not delivered | Instance status not `CONNECTED` | dashboard WhatsApp page, rescan QR |

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
