# AI Agent Operational Brief — Mantra AI

> **For:** Claude Code, Hermes, Cursor, Windsurf Cascade, or any autonomous coding/deploy agent.  
> **Purpose:** One document to orient yourself, validate context, and deploy without a back-and-forth.

---

## Your mission

Deploy **Mantra AI** (multi-tenant WhatsApp automation SaaS) or help the operator reason about it. Typical user prompts look like:

> *"Deploy Mantra to my VPS at X.X.X.X"*  
> *"The login page is broken — fix it"*  
> *"Add a new API endpoint for ..."*

Everything you need is in this repo. No hidden context.

---

## 📚 Reading order (triage first, don't dump everything)

> **⚠️ Start here first:** [`.agent/README.md`](./.agent/README.md) — a
> purpose-built skill pack with mission, architecture mental model, codebase
> map, conventions, runbooks, gotchas, verification rituals, and an
> append-only task log from previous agents. Read `.agent/` end-to-end
> before touching anything else. It supersedes the older brief below for
> code-level work.

| Priority | File | When to read |
|:-:|------|--------------|
| 0 | `.agent/` (whole directory, 7 files) | **Always, first.** Contains distilled operating knowledge. |
| 1 | `CREDENTIALS.md` | **If deploying.** Plaintext registry — gitignored. Contains every secret needed. |
| 2 | `ARCHITECTURE.md` | Always skim — system topology, env var matrix, data flow. |
| 3 | `DEPLOY_COOLIFY.md` | **If deploying to VPS.** Authoritative deploy procedure. |
| 4 | `DEVELOPMENT.md` | If running locally / debugging. |
| 5 | `docker-compose.yaml` | Service orchestration (5 containers). |
| 6 | `.env.example` | Environment variable contract. |
| 7 | `docs/api-contract.md` | If touching API surface. |
| 8 | `docs/database-schema.md` | If touching DB. |

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

```
                        ┌───────────────────┐
                        │  Coolify/Traefik  │  (HTTPS, Let's Encrypt)
                        └─────┬──────┬──────┘
                              │      │
              app.domain ─────┘      └───── api.domain
                    │                          │
                    ▼                          ▼
           ┌──────────────┐           ┌──────────────┐
           │ Next.js :5000│──────────▶│ Go Fiber :3001│
           │   (frontend) │  REST+WS  │   (backend)   │
           └──────────────┘           └───┬──────────┘
                                          │
                  ┌───────────────────────┼───────────────────────┐
                  ▼                       ▼                       ▼
           ┌────────────┐         ┌────────────┐         ┌──────────────┐
           │ Postgres 15│         │  Redis 7   │         │ Evolution API │
           │   :5432    │         │   :6379    │         │    :8080      │
           │ (127.0.0.1)│         │ (127.0.0.1)│         │  (internal)   │
           └────────────┘         └────────────┘         └──────────────┘
```

Ports 5432 and 6379 are bound to loopback (see `docker-compose.yaml`) — not publicly exposed. Only 80/443 (via Coolify) and 22 (SSH) should be open on the VPS firewall.

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

### Frontend (Next.js 14 App Router)
```
app/                   route handlers / pages
├── layout.tsx         providers + root shell
├── login/             login server action + page
├── page.tsx           dashboard overview
├── inbox/             WebSocket-backed live inbox
├── whatsapp/          WA instances + QR
├── ai-hub/            AI provider CRUD
├── tenants/           tenant mgmt
├── diagnosis/         SUPER_ADMIN only
├── settings/          SUPER_ADMIN only
└── dashboard/providers/  per-tenant WA provider settings

components/            shadcn/ui + feature components
hooks/                 data + session hooks
lib/
├── config.ts          ★ single source for env (serverConfig / clientConfig)
├── env.ts             Zod validation
├── auth.ts            JWT issue/verify + dev bypass
├── api-client.ts      typed fetch wrapper
└── sanitize.ts        XSS guard (DOMPurify)
proxy.ts               middleware: JWT + RBAC + security headers
```

### Backend (Go Fiber)
```
backend/
├── main.go            entry, /health, graceful shutdown
├── config/config.go   ★ env loading & validation
├── database/
│   ├── postgres.go    GORM connection + auto-migrate
│   ├── redis.go       graceful Redis client
│   └── init.sql       DDL source of truth (idempotent)
├── handlers/          auth, ai_providers, whatsapp, inbox, clients, system
├── middleware/auth.go JWT + RBAC
├── routes/routes.go   all route wiring
├── services/
│   ├── ai_fallback.go priority-sorted LLM chain
│   ├── evolution.go   Evolution API HTTP client
│   └── memory.go      Redis + Postgres 4-day TTL memory
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
