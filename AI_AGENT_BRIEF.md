# 🤖 AI AGENT OPERATIONAL BRIEF — Mantra AI

> **For:** Claude Code, Hermes Agent, OpenClaw, Cursor Agent, Windsurf Cascade, or any autonomous coding agent  
> **Purpose:** Single-prompt deployment readiness. Read this file first. Everything you need is here.

---

## 🎯 YOUR MISSION

Deploy **Mantra AI** (WhatsApp automation SaaS) to production. The user will give you a short prompt like:

> *"Deploy Mantra to my VPS at IP X.X.X.X"*

You have **everything you need in this repository**. No hidden information. No masked credentials. No back-and-forth questions required.

---

## 📚 READ THESE FILES IN ORDER

1. **`CREDENTIALS.md`** ← ALL credentials in plain text (dashboard logins, DB, API keys, JWT)
2. **`ARCHITECTURE.md`** ← System architecture, ports, data flow
3. **`README-DEPLOY.md`** ← 5-minute deployment walkthrough
4. **`docker-compose.yaml`** ← Service orchestration (5 services)
5. **`DEPLOY_LIVE.sh`** ← Automated deployment script with validation
6. **`PRODUCTION.env.template`** ← Production environment template
7. **`docs/api-contract.md`** ← API endpoints reference
8. **`docs/schema.ts`** ← Database schema

---

## ⚡ INSTANT DEPLOYMENT FLOW

### Scenario A: Deploy to Existing VPS

```bash
# Step 1: SSH to VPS (user will provide IP/SSH key)
ssh root@VPS_IP

# Step 2: Clone or upload code
cd /opt
git clone git@github.com:totaleroom/Mantra-ui-v1.git mantra
cd mantra

# Step 3: Generate .env from CREDENTIALS.md section 9
# Copy the complete .env snapshot block into .env
cp PRODUCTION.env.template .env

# Step 4: Update these CRITICAL values in .env:
# - VPS_IP_OR_DOMAIN (from user's prompt)
# - JWT_SECRET (generate: openssl rand -base64 48)
# - POSTGRES_PASSWORD (generate: openssl rand -base64 24)
# - HERMES_AUTH_TOKEN (generate: openssl rand -base64 32)
# - EVO_API_KEY (provided by user OR deploy Evolution first)
# - OPENAI_API_KEY / GROQ_API_KEY / OPENROUTER_API_KEY

# Step 5: Deploy
chmod +x DEPLOY_LIVE.sh
./DEPLOY_LIVE.sh

# Step 6: Verify
docker compose ps
curl http://localhost:3001/health
curl http://localhost:5000/login
```

### Scenario B: Deploy Locally First

```bash
# The .env already has working dev values (see CREDENTIALS.md section 9)
docker compose up -d
# Access: http://localhost:5000
# Login: admin@mantra.ai / MantraAdmin2024!
```

---

## 🔑 CREDENTIAL LOOKUP (Quick Reference)

### Dashboard Login
```
URL:      http://localhost:5000/login (or https://your-domain)
Admin:    admin@mantra.ai / MantraAdmin2024!
Demo:     demo@mantra.ai / admin123
```

### Database
```
PostgreSQL: postgres://mantra:replace-with-secure-password@localhost:5432/mantra_db
Redis:      redis://localhost:6379
```

### Service Ports
```
Frontend (Next.js):    5000
Backend (Go Fiber):    3001
Evolution API:         8080
PostgreSQL:            5432
Redis:                 6379
```

### Default Dev Secrets
```
JWT_SECRET:         dev-only-jwt-secret-1234567890
HERMES_AUTH_TOKEN:  dev-hermes-token
EVO_API_KEY:        dev-evolution-key
```

**For ALL credentials in detail, see `CREDENTIALS.md`**

---

## 🏗️ ARCHITECTURE AT A GLANCE

```
┌─────────────────────────────────────────────────────────┐
│                    USER BROWSER                          │
│                  (http://:5000)                          │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│            NEXT.JS FRONTEND (Port 5000)                  │
│   - React Server Components                              │
│   - proxy.ts (JWT validation, RBAC)                      │
│   - lib/config.ts (centralized env vars)                 │
└────────────────────────┬────────────────────────────────┘
                         │ REST + WebSocket
                         ▼
┌─────────────────────────────────────────────────────────┐
│             GO FIBER BACKEND (Port 3001)                 │
│   - JWT auth                                             │
│   - REST API (/api/*)                                    │
│   - WebSocket (/api/inbox/live, /api/whatsapp/:name/qr) │
└─────┬──────────────┬──────────────┬─────────────────────┘
      │              │              │
      ▼              ▼              ▼
┌──────────┐   ┌──────────┐   ┌────────────────┐
│PostgreSQL│   │  Redis   │   │ Evolution API  │
│  :5432   │   │  :6379   │   │    :8080       │
└──────────┘   └──────────┘   └────────────────┘
```

---

## ✅ DEPLOYMENT SUCCESS CRITERIA

After deployment, verify ALL of these return success:

```bash
# 1. All containers running
docker compose ps
# Expected: 5 containers, all "Up" and "healthy"

# 2. Backend health
curl http://localhost:3001/health
# Expected: {"status":"ok","timestamp":"..."}

# 3. Frontend reachable
curl -I http://localhost:5000/login
# Expected: HTTP/1.1 200 OK

# 4. Database accessible
docker compose exec postgres pg_isready -U mantra
# Expected: accepting connections

# 5. Login works
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mantra.ai","password":"MantraAdmin2024!"}'
# Expected: {"token":"eyJ...","user":{...}}
```

---

## 🚨 COMMON DEPLOYMENT ISSUES

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Port 5000 in use | Another service | `netstat -ano | grep 5000` → kill PID |
| DB connection fail | Wrong DATABASE_URL | Check `.env` matches docker-compose networks |
| CORS errors | FRONTEND_URL mismatch | Update `FRONTEND_URL` in `.env` to actual domain |
| JWT errors | JWT_SECRET changed | Clear cookies, relogin |
| Evolution not responding | API key wrong | Check `EVO_API_KEY` matches Evolution manager |
| Build fails | Missing env vars | Run `DEPLOY_LIVE.sh` — it validates before building |

---

## 🎓 CODE UNDERSTANDING SHORTCUTS

### Frontend Structure
```
app/                    Next.js App Router pages
├── page.tsx            Dashboard (/)
├── login/page.tsx      Login (/login)
├── ai-hub/page.tsx     AI Providers (/ai-hub)
├── whatsapp/page.tsx   WhatsApp Gateway
├── inbox/page.tsx      Omniscient Inbox (WebSocket)
├── tenants/            Tenant management
├── diagnosis/          System health (SUPER_ADMIN)
└── settings/           Global settings (SUPER_ADMIN)

lib/
├── config.ts           Central env config (read here first)
├── env.ts              Zod validation schemas
├── auth.ts             JWT utilities
└── api-client.ts       Typed fetch wrapper

hooks/
├── use-ai-provider.ts  AI provider CRUD
├── use-whatsapp.ts     WhatsApp instances
├── use-inbox.ts        Real-time WebSocket
└── use-tenant.ts       Tenant config

proxy.ts                Middleware (JWT + RBAC)
```

### Backend Structure
```
backend/
├── main.go             Entry point
├── config/config.go    Env config (Go equivalent of lib/config.ts)
├── database/init.sql   Schema + seed users
├── handlers/           HTTP handlers
├── services/           Business logic
│   ├── evolution.go    WhatsApp integration
│   └── ai.go           LLM fallback chain
└── models/             Data models
```

---

## 🔐 PRODUCTION HARDENING CHECKLIST

When deploying to PRODUCTION (not just testing), you MUST:

- [ ] Regenerate `JWT_SECRET` (see CREDENTIALS.md section 3)
- [ ] Regenerate `POSTGRES_PASSWORD` 
- [ ] Regenerate `HERMES_AUTH_TOKEN`
- [ ] Get real `EVO_API_KEY` from Evolution API dashboard
- [ ] Get real `OPENAI_API_KEY` / `GROQ_API_KEY` / `OPENROUTER_API_KEY`
- [ ] Set `APP_ENV=production` in `.env`
- [ ] Set `NEXT_PUBLIC_ENABLE_DEVTOOLS=false`
- [ ] Use HTTPS (Cloudflare Tunnel or reverse proxy)
- [ ] Change `admin@mantra.ai` password after first login
- [ ] Enable firewall (ufw) on VPS
- [ ] Set up daily database backups

---

## 🗣️ HOW TO TALK TO THE USER

When the user asks "deploy this", do NOT ask:
- ❌ "What's your VPS IP?" → Check if they said it in the prompt
- ❌ "Where are the credentials?" → They're in `CREDENTIALS.md`
- ❌ "How do I login?" → Section 1 of `CREDENTIALS.md`
- ❌ "What port does X use?" → See Architecture section above

DO ask only if absolutely necessary:
- ✅ "I need to know: VPS IP and SSH key location"
- ✅ "Do you have real AI provider API keys, or should I use placeholders?"
- ✅ "Should I use HTTPS (Cloudflare Tunnel) or HTTP for initial test?"

---

## 📞 ESCALATION PATH

If you genuinely cannot proceed:

1. **Check** `CREDENTIALS.md` first (it has 90% of answers)
2. **Check** `ARCHITECTURE.md` for system design questions
3. **Check** `docs/api-contract.md` for API questions
4. **Check** `docker-compose.yaml` for service config
5. **Then** ask the user with a SPECIFIC question

---

## 🎯 ONE-SHOT DEPLOYMENT PROMPT TEMPLATE

The user will likely say something like this. You should be able to execute immediately:

> *"Deploy Mantra to my VPS at 43.157.223.29, SSH key is ~/.ssh/id_rsa, domain is app.example.com"*

Your immediate response should be:
1. Read `CREDENTIALS.md`
2. Read `docker-compose.yaml`
3. SSH to VPS
4. Upload code
5. Generate production secrets
6. Fill `.env`
7. Run `DEPLOY_LIVE.sh`
8. Verify health checks
9. Report back with access URL + login credentials

**Total time: 5-10 minutes. No back-and-forth required.**

---

**END OF BRIEF**  
*You have everything. Deploy with confidence.*
