# Mantra AI - Documentation Index

> **Complete Documentation Hub** | Updated April 2026

---

## 📚 Quick Navigation

### 🚀 Getting Started

| Document | Purpose | Audience |
|----------|---------|----------|
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Complete system architecture & data flow | All developers |
| [README-DEPLOY.md](../README-DEPLOY.md) | 5-minute deployment guide | DevOps / Deployers |
| [deployment-guide.md](./deployment-guide.md) | Detailed VPS deployment | System administrators |

### 📋 Reference Documentation

| Document | Purpose | Audience |
|----------|---------|----------|
| [api-contract.md](./api-contract.md) | REST API & WebSocket specs | Backend developers |
| [schema.ts](./schema.ts) | Database schema (Drizzle ORM) | Backend developers |
| [backend-boilerplate-hint.go](./backend-boilerplate-hint.go) | Go backend boilerplate code | Go developers |
| [handover-manifest.md](./handover-manifest.md) | Integration summary | Hermes Agent / DevOps |

### 🎯 Planning & Requirements

| Document | Purpose | Audience |
|----------|---------|----------|
| [PRD.md](./PRD.md) | Product requirements & features | Product team |

---

## 🆕 Recent Updates (April 2026)

### New Files Added

1. **[DEPLOY_LIVE.sh](../DEPLOY_LIVE.sh)** - Automated deployment script with validation
2. **[PRODUCTION.env.template](../PRODUCTION.env.template)** - Production environment template
3. **[README-DEPLOY.md](../README-DEPLOY.md)** - Quick deployment guide (5 minutes)
4. **[LIVE_STATUS.md](../LIVE_STATUS.md)** - Deployment readiness report
5. **[ARCHITECTURE.md](../ARCHITECTURE.md)** - Comprehensive system documentation
6. **[COMMIT.md](../COMMIT.md)** - Professional commit message template
7. **[GIT_COMMANDS.txt](../GIT_COMMANDS.txt)** - GitHub push commands

### Security Hardening

- ✅ `.env.example` reorganized with 6 grouped sections
- ✅ All hardcoded IPs removed from `docker-compose.yaml`
- ✅ `process.env` calls refactored to use `serverConfig`
- ✅ `.gitignore` updated with strict security patterns
- ✅ `init.sql` wrapped in environment-aware conditional

### Environment Variable Groups

```
[FRONTEND_NEXTJS]    - Public vars (NEXT_PUBLIC_*)
[BACKEND_GO]         - Server config (JWT_SECRET, etc.)
[DATABASE_POSTGRES]  - PostgreSQL & Redis
[WHATSAPP_PROVIDER]  - Evolution API settings
[AGENTIC_AI]         - LLM provider keys
[FEATURE_FLAGS]      - Development toggles
[DEPLOYMENT_VPS]     - Production settings
```

---

## 🚀 Deployment Options

### Option 1: Quick Local Test (Docker Compose)

```bash
cd Mantra-ui-v1

# Copy and edit environment
cp PRODUCTION.env.template .env
nano .env  # Edit dengan domain/IP Anda

# Deploy semua services
./DEPLOY_LIVE.sh
```

### Option 2: VPS Production

```bash
# Upload ke VPS
scp -r Mantra-ui-v1 root@your-vps:/opt/mantra

# SSH dan deploy
ssh root@your-vps
cd /opt/mantra
./DEPLOY_LIVE.sh
```

### Option 3: Development Mode (No Docker)

```bash
# Frontend only
npm run dev

# Backend (terpisah)
cd backend
go run main.go
```

---

## 🔐 Security Checklist

Sebelum deploy ke production:

- [ ] JWT_SECRET ≥ 32 karakter random
- [ ] POSTGRES_PASSWORD kuat (16+ karakter)
- [ ] Semua API key valid (Evolution, OpenAI/Groq)
- [ ] FRONTEND_URL menggunakan HTTPS
- [ ] .env tidak di-commit (termasuk di .gitignore)
- [ ] Password default diubah setelah login pertama

---

## 📊 System Resources

| Service | RAM | Port | Purpose |
|---------|-----|------|---------|
| PostgreSQL | 512 MB | 5432 | Data persistence |
| Redis | 256 MB | 6379 | Cache & sessions |
| Evolution API | 1 GB | 8080 | WhatsApp gateway |
| Go Backend | 256 MB | 3001 | API & business logic |
| Next.js Frontend | 256 MB | 5000 | Web UI |
| **Total** | **~2.3 GB** | - | Under 2.6GB budget |

---

## 🌐 Default Endpoints (Local)

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5000 |
| Backend API | http://localhost:3001 |
| Health Check | http://localhost:3001/health |
| Evolution API | http://localhost:8080 |

### Default Login

- **Email:** `admin@mantra.ai`
- **Password:** `MantraAdmin2024!`
- **⚠️ Ubah segera setelah login!**

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 5000 in use | `docker compose restart` atau kill process |
| Database connection failed | Check `DATABASE_URL` di .env |
| Backend won't start | Check `JWT_SECRET` sudah di-set |
| Evolution API error | Verify `EVO_API_KEY` valid |

---

## 📞 Support

- **Architecture:** [ARCHITECTURE.md](../ARCHITECTURE.md)
- **API Contract:** [api-contract.md](./api-contract.md)
- **Deployment:** [README-DEPLOY.md](../README-DEPLOY.md)
- **Environment:** [.env.example](../.env.example)

---

*Last Updated: April 2026 | Principal AI Architect & Vibe Coding Orchestrator*
