# Handover Manifest - Mantra AI

> Final Integration Summary for Backend Developers, DevOps, and Hermes Agent

**Version:** 2.2 Production Ready (Security Hardened)  
**Generated:** April 2026  
**Status:** Complete with automated deployment  
**Design System:** FinFlow-inspired neutral palette with light/dark mode support

---

## 🆕 What's New (April 2026)

### Deployment Automation
- ✅ **[DEPLOY_LIVE.sh](../DEPLOY_LIVE.sh)** - One-command deployment with validation
- ✅ **[PRODUCTION.env.template](../PRODUCTION.env.template)** - Production-ready .env template
- ✅ **[README-DEPLOY.md](../README-DEPLOY.md)** - 5-minute deployment guide
- ✅ **[ARCHITECTURE.md](../ARCHITECTURE.md)** - Complete system documentation

### Security Hardening
- ✅ All `process.env` calls centralized via `serverConfig`
- ✅ Hardcoded IPs removed from `docker-compose.yaml`
- ✅ `.env.example` reorganized with 6 grouped sections
- ✅ `.gitignore` updated with strict patterns
- ✅ Database seeding wrapped in environment checks

### Environment Variable Groups
```
[FRONTEND_NEXTJS]    - NEXT_PUBLIC_* (browser-safe)
[BACKEND_GO]         - Server secrets (JWT, DB URLs)
[DATABASE_POSTGRES]  - PostgreSQL & Redis config
[WHATSAPP_PROVIDER]  - Evolution API settings
[AGENTIC_AI]         - LLM provider API keys
[FEATURE_FLAGS]      - Development toggles
```

---

## 1. Routes Created

| Route | Component | Purpose | Access Level |
|-------|-----------|---------|--------------|
| `/` | `app/page.tsx` | Dashboard overview with live stats | All authenticated |
| `/login` | `app/login/page.tsx` | Authentication page | Public |
| `/ai-hub` | `app/ai-hub/page.tsx` | AI Provider management with fallback logic | All authenticated |
| `/whatsapp` | `app/whatsapp/page.tsx` | WhatsApp Gateway (Evolution API bridge) | All authenticated |
| `/inbox` | `app/inbox/page.tsx` | Omniscient Inbox with real-time updates | All authenticated |
| `/tenants` | `app/tenants/page.tsx` | Tenant list with search/filter | All authenticated |
| `/tenants/[id]` | `app/tenants/[id]/page.tsx` | Per-tenant AI config, RAG, memory settings | All authenticated |
| `/diagnosis` | `app/diagnosis/page.tsx` | System health monitoring | SUPER_ADMIN only |
| `/settings` | `app/settings/page.tsx` | Global configuration | SUPER_ADMIN only |

**Total Routes: 9**

### Authentication Flow
1. User accesses `/login` (public)
2. Credentials sent to `/api/auth/login` → Go backend
3. JWT returned and stored in HTTP-only cookie
4. `proxy.ts` middleware validates JWT on every request
5. Role-based access enforced (SUPER_ADMIN, CLIENT_ADMIN, STAFF)

---

## 2. Expected API Endpoints

### REST Endpoints (Go Fiber Backend)

```
Base URL: ${NEXT_PUBLIC_API_URL}

# AI Providers
GET    /api/ai-providers              # List all providers
POST   /api/ai-providers              # Create provider
PUT    /api/ai-providers/:id          # Update provider
DELETE /api/ai-providers/:id          # Delete provider
PATCH  /api/ai-providers/:id/toggle   # Toggle active status
PUT    /api/ai-providers/priorities   # Reorder fallback chain
GET    /api/ai-providers/models       # Fetch all available models

# WhatsApp Instances
GET    /api/whatsapp/instances        # List instances
POST   /api/whatsapp/instances        # Create instance
DELETE /api/whatsapp/instances/:id    # Delete instance
POST   /api/whatsapp/instances/:id/disconnect  # Disconnect

# Inbox
GET    /api/inbox/messages            # Fetch messages (paginated)
GET    /api/inbox/stats               # Message statistics

# Tenants
GET    /api/tenants                   # List all clients
GET    /api/tenants/:id               # Get single tenant
GET    /api/tenants/:id/ai-config     # Get AI configuration
PUT    /api/tenants/:id/ai-config     # Update AI configuration

# System Diagnosis
GET    /api/diagnosis/services        # Health status of all services
POST   /api/diagnosis/services/:name/repair  # Trigger repair

# Settings
GET    /api/settings                  # Get global settings
PUT    /api/settings                  # Update settings
```

---

## 3. WebSocket Event Names

### Inbox Live Feed
**Endpoint:** `wss://${API_URL}/api/inbox/live`

| Event Type | Direction | Payload |
|------------|-----------|---------|
| `message` | Server → Client | `{ type: "message", data: InboxMessage }` |
| `stats_update` | Server → Client | `{ type: "stats_update", data: InboxStats }` |
| `ping` | Server → Client | `{ type: "ping" }` |
| `pong` | Client → Server | `{ type: "pong" }` |

**InboxMessage Schema:**
```typescript
{
  id: string
  clientId: number
  clientName: string
  customerNumber: string
  message: string
  direction: "inbound" | "outbound"
  timestamp: string (ISO 8601)
  aiThoughtProcess?: string
  modelUsed?: string
}
```

### QR Code Stream
**Endpoint:** `wss://${API_URL}/api/whatsapp/instances/:name/qr`

| Event Type | Direction | Payload |
|------------|-----------|---------|
| `qr` | Server → Client | `{ type: "qr", data: string (base64) }` |
| `connected` | Server → Client | `{ type: "connected" }` |
| `error` | Server → Client | `{ type: "error", message: string }` |
| `refresh` | Client → Server | `{ type: "refresh" }` |

---

## 4. Deployment Options

### Option A: Automated Deployment (Recommended)

```bash
# 1. Upload to VPS
scp -r Mantra-ui-v1 root@your-vps:/opt/

# 2. SSH ke VPS
ssh root@your-vps
cd /opt/Mantra-ui-v1

# 3. Copy and edit environment
cp PRODUCTION.env.template .env
nano .env  # Edit dengan domain/IP Anda

# 4. Deploy otomatis dengan validasi
chmod +x DEPLOY_LIVE.sh
./DEPLOY_LIVE.sh
```

### Option B: Manual Docker Compose

```bash
cd /opt/mantra

# Copy environment
cp .env.example .env
# Edit .env dengan editor

# Build dan start
docker compose up -d

# Check status
docker compose ps
```

### Option C: Local Development

```bash
# Mode 1: Full stack dengan Docker
docker compose up -d

# Mode 2: Frontend only (mock data)
set NEXT_PUBLIC_ENABLE_MOCK_DATA=true
npm run dev

# Mode 3: Terpisah
# Terminal 1: Backend
cd backend && go run main.go
# Terminal 2: Frontend
npm run dev
```

---

## 5. Critical Instructions for Hermes Agent

### Pre-Deployment Checklist

1. **System Requirements**
   - Docker & Docker Compose (atau VPS dengan 2GB+ RAM)
   - Node.js 18+ (untuk development)
   - Go 1.21+ (untuk backend development)

2. **Environment Setup**
   ```bash
   # Copy template
cp PRODUCTION.env.template .env

   # Edit dengan nilai Anda:
   # - VPS_IP_OR_DOMAIN: http://localhost atau https://your-domain.com
   # - JWT_SECRET: openssl rand -base64 48
   # - POSTGRES_PASSWORD: openssl rand -base64 24
   # - EVO_API_KEY: dari Evolution API dashboard
   # - OPENAI_API_KEY atau GROQ_API_KEY: dari provider
   ```

3. **Services Architecture**
   ```yaml
   # RAM Budget: < 2.6 GB
   postgres:     512MB  (Port 5432)
   redis:        256MB  (Port 6379)
   evolution:    1GB    (Port 8080)
   backend:      256MB  (Port 3001)
   frontend:     256MB  (Port 5000)
   ```

4. **Post-Deployment Verification**
   ```bash
   # Test health endpoint
   curl http://localhost:3001/health
   
   # Test frontend
   curl http://localhost:5000/login
   
   # Check all services
   docker compose ps
   ```

### Deployment Order

#### For VPS Production:
1. Upload code ke VPS
2. Copy `PRODUCTION.env.template` → `.env` dan edit
3. Run `./DEPLOY_LIVE.sh` (otomatis: build → start → validate)
4. Configure Cloudflare Tunnel (optional, untuk HTTPS)
5. Verify semua services healthy

#### For Local Development:
1. Clone/copy repository
2. Copy `.env.example` → `.env`
3. Edit dengan local values (localhost)
4. Run `docker compose up -d`
5. Access http://localhost:5000

### Security Notes
- **NEVER** commit `.env` file
- **NEVER** use default passwords in production
- **ALWAYS** use HTTPS di production
- **ALWAYS** ganti password default setelah login pertama

---

## 5. Frontend-Backend Contract Summary

### Authentication Flow
1. Frontend sends credentials to `/api/auth/login`
2. Backend returns JWT token + user role
3. Frontend stores token in HTTP-only cookie (set by backend)
4. All subsequent requests include cookie automatically
5. Middleware checks role for protected routes

### Error Response Format
```json
{
  "error": true,
  "message": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

### Pagination Format
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

## 6. Key Files Reference

### Configuration & Environment
| File | Purpose |
|------|---------|
| `.env.example` | Environment variable template (6 grouped sections) |
| `PRODUCTION.env.template` | Production deployment template |
| `lib/config.ts` | Centralized environment config |
| `lib/env.ts` | Zod schema validation |
| `backend/config/config.go` | Go backend config |

### Deployment
| File | Purpose |
|------|---------|
| `DEPLOY_LIVE.sh` | Automated deployment script |
| `docker-compose.yaml` | Service orchestration |
| `README-DEPLOY.md` | Quick deployment guide |
| `ARCHITECTURE.md` | System architecture docs |

### Security
| File | Changes |
|------|---------|
| `.gitignore` | Strict security patterns (env, secrets, build) |
| `proxy.ts` | JWT validation, RBAC, security headers |
| `lib/auth.ts` | Authentication utilities |
| `lib/sanitize.ts` | XSS prevention |
| `backend/database/init.sql` | Environment-aware seeding |

### Core Components
| File | Purpose |
|------|---------|
| `app/login/page.tsx` | Authentication page |
| `app/page.tsx` | Dashboard |
| `app/ai-hub/page.tsx` | AI Provider management |
| `app/whatsapp/page.tsx` | WhatsApp Gateway |
| `app/inbox/page.tsx` | Real-time inbox |
| `app/tenants/page.tsx` | Tenant management |
| `app/diagnosis/page.tsx` | System health |

### Hooks & API
| File | Purpose |
|------|---------|
| `hooks/use-ai-provider.ts` | AI provider CRUD |
| `hooks/use-whatsapp.ts` | WhatsApp instances |
| `hooks/use-inbox.ts` | Real-time inbox WebSocket |
| `hooks/use-tenant.ts` | Tenant configuration |
| `lib/api-client.ts` | Typed fetch wrapper |

---

## 7. Testing Checklist

- [ ] All forms validate with Zod schemas
- [ ] Skeleton loading appears on all data pages
- [ ] Mobile navigation drawer works
- [ ] WebSocket reconnects on disconnect
- [ ] QR code refreshes when expired
- [ ] Toast notifications for all actions
- [ ] Protected routes redirect unauthorized users
- [ ] XSS payloads are sanitized in inbox

---

**Frontend Complete. Ready for Backend Integration.**
