# AI Agent Operational Brief — Mantra AI (TL;DR)

> **For:** Claude Code, Hermes, Cursor, Windsurf Cascade, or any autonomous coding/deploy agent.  
> **Purpose:** 2-minute orientation. Then hand off to the deeper docs.
>
> ⚠️ **If you just cloned the repo from GitHub, read
> [`.agent/00-START-HERE.md`](./.agent/00-START-HERE.md) instead of this
> file.** That has a step-by-step bootstrap. This brief is meta-level
> context for anyone who already knows what Mantra *is*.

---

## Your mission

Continue building / deploying **Mantra AI** (multi-tenant WhatsApp automation SaaS).

Typical user prompts:

> *"Deploy Mantra to my VPS at X.X.X.X"*  
> *"The login page is broken — fix it"*  
> *"Add a new API endpoint for …"*  
> *"Implement Phase 5 (tiered model routing)"*

Everything you need is in this repo. No hidden context.

## Current project status (as of last commit)

| Phase | Status |
|-------|--------|
| 0. Baseline (Next.js + Go + Postgres + Redis + Evolution) | ✅ shipped |
| 1. Visual polish (Apple × Nothing OS) | 🟡 Tier 1 done, per-page audit pending |
| 2. Knowledge Base (pgvector chunks + FAQs + UI) | ✅ shipped |
| 3. RAG integration to orchestrator | ✅ shipped |
| 4. Tool calling (function calling + webhook/builtin handlers) | ✅ shipped |
| 5. Tiered model routing (cheap → escalate) | ⚪ planned |
| 6. Production hardening (rate limit, logs, backups, handoff) | ⚪ planned |

Always cross-check against [`.agent/10-commercial-mvp-roadmap.md`](./.agent/10-commercial-mvp-roadmap.md) and the top entry of [`.agent/07-task-log.md`](./.agent/07-task-log.md).

---

## 📚 Reading order (triage first, don't dump everything)

> **⚠️ Start here first:** [`.agent/00-START-HERE.md`](./.agent/00-START-HERE.md)
> for the 10-minute bootstrap, then [`.agent/README.md`](./.agent/README.md)
> to see the full skill-pack index. Together these supersede the brief below
> for code-level work.

| Priority | File | When to read |
|:-:|------|--------------|
| 0 | `.agent/` (12 files incl. `00-START-HERE.md`) | **Always, first.** Contains distilled operating knowledge + phase roadmap + task log. |
| 1 | `CREDENTIALS.md` | **If deploying.** Plaintext registry — gitignored. Contains every secret needed. |
| 2 | `ARCHITECTURE.md` | Always skim — system topology, env var matrix, data flow (incl. RAG + tool flow). |
| 3 | `DEPLOY_COOLIFY.md` (generic) or `.agent/09-single-user-deployment.md` (our actual Tailscale + Coolify setup) | **If deploying to VPS.** |
| 4 | `.agent/11-phase-2-4-deploy-smoke-test.md` | **After every deploy** — 9-step runbook proving KB + RAG + tools work. |
| 5 | `DEVELOPMENT.md` | If running locally / debugging. |
| 6 | `docker-compose.yaml` | Service orchestration (5 containers). Uses `pgvector/pgvector:pg15`. |
| 7 | `.env.example` | Environment variable contract. |
| 8 | `docs/api-contract.md` | If touching API surface. Updated with Phase 2 (Knowledge Base) + Phase 4 (Client Tools) endpoints. |
| 9 | `docs/database-schema.md` | If touching DB. 11 tables post-Phase-4 (3 new: `client_knowledge_chunks`, `client_faqs`, `client_tools`). |

Do **not** re-read everything for every turn. Cache in your working memory.

---

## ⚡ Deployment flow — VPS via Coolify (canonical path)

The user will give you an IP + domain (or will defer domain setup). You execute:

```bash
# 1. SSH to VPS
ssh root@VPS_IP

# 2. Install Coolify (only on first-time)
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
# Open http://VPS_IP:8000 → complete onboarding → get Coolify dashboard URL

# 3. In Coolify UI:
#    - Add Source: GitHub repo (needs public repo or deploy key)
#    - New Resource → "Docker Compose" build pack
#    - Point at root docker-compose.yaml
#    - Environment: paste grouped vars from CREDENTIALS.md / .env.example
#      * REGENERATE JWT_SECRET, POSTGRES_PASSWORD, HERMES_AUTH_TOKEN before deploy
#    - Domains: map frontend:5000 → app.domain, backend:3001 → api.domain
#    - Click Deploy

# 4. Verify
curl https://api.<domain>/health         # {"status":"ok","db":"connected","redis":"connected"}
curl -I https://app.<domain>/login       # 200 OK
```

Complete walkthrough: [`DEPLOY_COOLIFY.md`](./DEPLOY_COOLIFY.md).

### Alternate path — plain `docker compose` (no Coolify)

If the user explicitly refuses Coolify:

```bash
ssh root@VPS_IP
cd /opt && git clone <repo> mantra && cd mantra
cp .env.example .env
# edit .env: regenerate all REQUIRED secrets (see checklist below)
docker compose up -d
docker compose ps              # all 5 services "Up (healthy)"
```

Bind domains via a separate Traefik / Caddy / nginx install if needed.

---

## 🔐 Secret regeneration (MANDATORY before any production deploy)

```bash
openssl rand -base64 48     # → JWT_SECRET
openssl rand -base64 24     # → POSTGRES_PASSWORD
openssl rand -base64 32     # → HERMES_AUTH_TOKEN
```

`CREDENTIALS.md` contains the current dev/placeholder values. **Never** use those in production. Replace all three, then update the corresponding rows in `.env` / Coolify env panel.

---

## 🗺️ Architecture at a glance

Five services on one VPS, orchestrated by Coolify + Traefik:
**Next.js frontend (5000)** → **Go Fiber backend (3001)** → Postgres 15 +
**pgvector** (5432, loopback) / Redis 7 (6379, loopback) / Evolution API
(8080, container-internal).

The backend also calls external AI providers (OpenAI / Groq / OpenRouter)
and, for Phase 4 tool calling, the tenant's own webhook URL when the LLM
invokes a webhook-handler tool.

**Diagrams live in:**
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) § 3 — service architecture + 5.5 RAG flow + 5.6 tool flow.
- [`.agent/01-architecture.md`](./.agent/01-architecture.md) — opinionated message-flow for AI agents.

Ports 5432 and 6379 are bound to loopback (see `docker-compose.yaml`) — not publicly exposed. Only 80/443 (via Coolify) and 22 (SSH) should be open on the VPS firewall. For the actual Tailscale-private topology we use in production, see `.agent/09-single-user-deployment.md`.

---

## ✅ Success criteria

After deploy, ALL of these must pass:

```bash
docker compose ps                       # 5 services, all "Up (healthy)"
curl https://api.<domain>/health        # {"status":"ok","db":"connected","redis":"connected"}
curl -I https://app.<domain>/login      # HTTP/2 200
curl -X POST https://api.<domain>/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"admin@mantra.ai","password":"MantraAdmin2024!"}'
# → {"token":"eyJ...","user":{"role":"SUPER_ADMIN",...}}
```

Report back to the user with:
1. The app URL + login URL
2. Which default credentials were seeded (admin + demo)
3. A reminder to **change both passwords** immediately
4. Any warnings (e.g. HTTP-only so far, backups not yet scheduled)

---

## 🚨 Common deployment issues

| Symptom | Root cause | Fix |
|---------|-----------|-----|
| Port 5000/3001 already in use | Another container/process | `netstat -tulpn \| grep :5000`, stop or change port |
| Backend `db: unreachable` | `DATABASE_URL` wrong in env | Use service name (`postgres`) not `localhost` inside compose network |
| Login returns 401 | Seed didn't run | `docker compose exec postgres psql -U mantra -d mantra_db -f /docker-entrypoint-initdb.d/init.sql` |
| CORS error on browser | `FRONTEND_URL` mismatch | Set to exact origin including scheme — `https://app.domain` |
| JWT "signature verify" error | Secret mismatch between frontend and backend | Ensure same `JWT_SECRET` in both services' env |
| Frontend can't reach backend (prod) | `NEXT_PUBLIC_API_URL` points to `localhost` | Set to `https://api.<domain>` |
| Evolution API won't start | `SERVER_URL` missing or DB not ready | Check `depends_on: { postgres: service_healthy }` |

---

## 🧭 Codebase quick map

Detailed reverse index lives in
[`.agent/02-codebase-map.md`](./.agent/02-codebase-map.md). Highlights:

### Frontend (Next.js 16 App Router)
```
app/                            route handlers / pages
├── layout.tsx                  providers + root shell
├── login/                      login server action + page
├── inbox/                      WebSocket-backed live inbox
├── whatsapp/                   WA instances + QR
├── ai-hub/                     AI provider CRUD
├── tenants/
│   └── [id]/
│       ├── page.tsx            tenant detail + AI config
│       ├── knowledge/page.tsx  ★ Phase 2 — chunks + FAQs UI
│       └── tools/page.tsx      ★ Phase 4 — tool registry UI
├── diagnosis/                  SUPER_ADMIN only
└── settings/                   SUPER_ADMIN only

hooks/                 use-whatsapp, use-inbox-live, use-session,
                       use-knowledge (Phase 2), use-tools (Phase 4), …
lib/
├── config.ts          ★ single source for env (serverConfig / clientConfig)
├── env.ts             Zod validation
├── auth.ts            JWT issue/verify + dev bypass
├── api-client.ts      typed fetch wrapper
└── sanitize.ts        XSS guard (DOMPurify)
middleware.ts          JWT + RBAC + security headers
```

### Backend (Go Fiber)
```
backend/
├── main.go            entry, /health, graceful shutdown
├── config/config.go   ★ env loading & validation
├── database/
│   ├── postgres.go    GORM connection + auto-migrate
│   ├── redis.go       graceful Redis client
│   └── init.sql       DDL source of truth (11 tables, idempotent, includes pgvector)
├── models/
│   ├── models.go      core GORM models + AutoMigrate registry
│   ├── knowledge.go   ★ Phase 2 — KnowledgeChunk, FAQ, JSONB alias
│   └── tool.go        ★ Phase 4 — ClientTool + HandlerType* constants
├── handlers/          auth, ai, whatsapp, inbox, clients, system,
│                      knowledge (Phase 2), tools (Phase 4)
├── middleware/auth.go JWT + RBAC
├── routes/routes.go   all route wiring (Phase 2/4 endpoints inside clients group)
├── services/
│   ├── ai_fallback.go priority-sorted LLM chain; Chat + ChatWithTools (Phase 4)
│   ├── evolution.go   Evolution API HTTP client
│   ├── memory.go      Redis + Postgres 4-day TTL memory
│   ├── embedding.go   ★ Phase 2 — OpenAI-compat embedding client (text-embedding-3-small)
│   ├── retrieval.go   ★ Phase 3 — RAG: FAQ keyword + pgvector ANN
│   ├── tools.go       ★ Phase 4 — ToolService (builtin + webhook, SSRF-mitigated)
│   └── orchestrator.go HandleInbound + buildConversation + runReplyLoop
└── ws/                inbox live + QR WebSocket hubs
```

---

## 🔐 Production hardening checklist

When graduating from test-deploy to real-production:

- [ ] `JWT_SECRET`, `POSTGRES_PASSWORD`, `HERMES_AUTH_TOKEN` regenerated
- [ ] `APP_ENV=production`
- [ ] `NEXT_PUBLIC_ENABLE_DEVTOOLS=false`, `NEXT_PUBLIC_ENABLE_MOCK_DATA=false`
- [ ] `FRONTEND_URL` is exact production origin (affects CORS)
- [ ] HTTPS live (Coolify/Traefik handles, verify cert)
- [ ] Default admin (`admin@mantra.ai`) password changed via UI or direct `UPDATE`
- [ ] UFW: only 22, 80, 443 inbound (SSH key-only, no password)
- [ ] Daily `pg_dump` cron to off-box storage
- [ ] Real API keys for `EVO_API_KEY`, at least one of `OPENAI_API_KEY` / `GROQ_API_KEY` / `OPENROUTER_API_KEY`

---

## 🗣️ Interacting with the user

**Do not** ask the user for information already in the repo:
- Port numbers → `ARCHITECTURE.md` §4 or `docker-compose.yaml`
- Credentials → `CREDENTIALS.md`
- Env var meaning → `.env.example` (grouped & commented)
- API shape → `docs/api-contract.md`
- DB fields → `docs/database-schema.md`

**Do** ask for:
- Info they must supply: VPS IP, domain, real AI provider keys
- Confirmation before destructive ops (`docker compose down -v`, `DROP TABLE`, force push)
- Explicit confirmation when deviating from `DEPLOY_COOLIFY.md`

Report results in a compact table, not prose walls. Single-line status, then details on request.

---

## 📞 Escalation path

If genuinely stuck:
1. Re-read the relevant file from the priority list above.
2. Check `docker compose logs <service> --tail=100`.
3. Check the `/health` endpoint JSON — it tells you which dependency is failing.
4. Only then ask the user — with a **specific** question.

---

**End of brief.** You have enough to act.
