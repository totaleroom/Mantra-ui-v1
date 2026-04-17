# Mantra AI - System Architecture Document

> **Version**: MVP v1.0  
> **Last Updated**: April 2026  
> **Purpose**: Persistent memory context for AI-assisted development

---

## 1. System Overview

Mantra AI is a multi-tenant SaaS platform for AI-powered WhatsApp automation, targeting UMKM (small-medium business) clients.

### Core Value Proposition
- **Multi-tenant architecture**: Single backend serves 50+ clients
- **AI-powered responses**: Automatic customer query handling via LLM
- **WhatsApp gateway**: Evolution API integration for WhatsApp Business
- **Real-time inbox**: WebSocket-based live message streaming
- **Role-based access**: SUPER_ADMIN, CLIENT_ADMIN, STAFF

---

## 2. Tech Stack

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Frontend** | Next.js | 14 (App Router) | React framework, SSR/SSG |
| **UI Library** | ShadcnUI + Tailwind | v4 | Component library, styling |
| **State** | TanStack Query | v5 | Server state, caching |
| **Forms** | React Hook Form + Zod | latest | Validation, type safety |
| **Backend** | Go Fiber | v2 | HTTP API, WebSocket |
| **Database** | PostgreSQL | 15 | Primary data store |
| **Cache** | Redis | 7 | Session, real-time data |
| **WhatsApp** | Evolution API | latest | WhatsApp gateway |
| **Auth** | JWT (jose) | v6 | Stateless authentication |

---

## 3. Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT BROWSER                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  Next.js    │  │  WebSocket  │  │  Evolution API (QR)     │ │
│  │  (Port 5000)│  │  (Port 3001)│  │  (Port 8080)            │ │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────────┘ │
└─────────┼────────────────┼─────────────────────────────────────┘
          │                │
          ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE TUNNEL (VPS)                     │
│                        HTTPS Termination                        │
└─────────────────────────┬───────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
│   Next.js App   │ │ Go Backend  │ │ Evolution API   │
│   (Docker)      │ │ (Docker)    │ │ (Docker)        │
│   Port: 5000    │ │ Port: 3001  │ │ Port: 8080      │
│   RAM: 256MB    │ │ RAM: 256MB  │ │ RAM: 1GB        │
└────────┬────────┘ └──────┬──────┘ └─────────────────┘
         │                 │
         │    ┌────────────┼────────────┐
         │    ▼            ▼            ▼
         │ ┌────────┐  ┌────────┐  ┌────────────┐
         │ │PostgreSQL│  │ Redis  │  │ (WhatsApp) │
         │ │Port: 5432│  │Port: 6379│  │ (External) │
         │ │RAM: 512MB│  │RAM: 256MB│  └────────────┘
         │ └────────┘  └────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│         AI Provider APIs                │
│  (OpenAI, Groq, OpenRouter, Custom)     │
└─────────────────────────────────────────┘
```

---

## 4. Network Ports & Endpoints

| Service | Internal Port | External Access | Protocol |
|---------|---------------|-----------------|----------|
| Next.js Frontend | 5000 | `FRONTEND_URL` | HTTP |
| Go Backend | 3001 | Via tunnel | HTTP/WebSocket |
| PostgreSQL | 5432 | Internal only | TCP |
| Redis | 6379 | Internal only | TCP |
| Evolution API | 8080 | Internal + webhook | HTTP |

### Critical API Endpoints (Go Backend)
```
POST   /api/auth/login          # JWT token issuance
POST   /api/auth/logout         # Session termination
GET    /health                  # Health check (db + redis)
GET    /api/clients             # List tenants
POST   /api/clients             # Create tenant
GET    /api/whatsapp/instances  # List WhatsApp instances
POST   /api/whatsapp/instances # Create instance
GET    /api/whatsapp/instances/:name/qr  # Get QR code (base64)
WS     /api/inbox/live          # Real-time inbox stream
```

### Next.js API Routes (Proxy to Go)
```
POST   /api/auth/login          # Proxies to Go backend
POST   /api/auth/logout         # Cookie management
GET    /api/whatsapp/*          # Proxies to Go backend
```

---

## 5. Data Flow

### 5.1 Authentication Flow
```
1. User submits credentials → POST /api/auth/login
2. Next.js API route proxies → Go backend
3. Go validates → PostgreSQL users table (bcrypt)
4. Go issues JWT → Returns to Next.js
5. Next.js sets HTTP-only cookie: mantra_session
6. Middleware (proxy.ts) validates JWT on each request
```

### 5.2 WhatsApp Connection Flow
```
1. SUPER_ADMIN creates instance → POST /api/whatsapp/instances
2. Go backend calls Evolution API → POST /instance/create
3. Evolution API provisions WhatsApp Web session
4. Frontend polls GET /api/whatsapp/instances/:name/qr
5. User scans QR code with WhatsApp mobile app
6. Evolution API establishes connection → Webhook to Go backend
7. Status updates pushed via WebSocket or polling
```

### 5.3 Message Processing Flow
```
1. Customer sends WhatsApp message
2. Evolution API receives → Webhook to Go backend /webhook/evolution
3. Go backend:
   a. Identifies client by instance_name
   b. Fetches AI config from client_ai_configs
   c. Calls AI provider with system_prompt + memory
   d. Stores message in inbox_messages
   e. Broadcasts via WebSocket to connected clients
4. Frontend receives WebSocket update → Updates inbox UI
```

### 5.4 AI Response Flow
```
1. Go backend receives customer message
2. Fetch active AI providers (priority-sorted)
3. Try primary provider:
   - Build prompt: system_prompt + memory + customer_message
   - Call API with timeout
   - If success → Return response
   - If fail → Log to ai_providers.last_error → Try fallback
4. Store AI thought process in ai_thought_process column
5. Send response via Evolution API send-message endpoint
```

---

## 6. Database Schema

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | Authentication | email, password (bcrypt), role |
| `clients` | Tenants | name, token_balance, token_limit, is_active |
| `ai_providers` | LLM credentials | provider_name, api_key, base_url, priority |
| `client_ai_configs` | AI persona | model_id, system_prompt, temperature |
| `whatsapp_instances` | WA connections | instance_name, status, webhook_url |
| `customer_memories` | 4-day TTL memory | summary, raw_history, expires_at |
| `inbox_messages` | Message history | direction, ai_thought_process |
| `system_diagnoses` | Health monitoring | service_name, status, latency |

### Key Relationships
```
clients (1) ──→ (N) ai_providers
clients (1) ──→ (1) client_ai_configs
clients (1) ──→ (N) whatsapp_instances
clients (1) ──→ (N) customer_memories
clients (1) ──→ (N) inbox_messages
```

---

## 7. Environment Variable Matrix

### Frontend (NEXT_PUBLIC_*) - Browser Safe
| Variable | Required | Default | Used In |
|----------|----------|---------|---------|
| NEXT_PUBLIC_API_URL | Yes | localhost:3001 | api-client.ts |
| NEXT_PUBLIC_WS_URL | Yes | ws://localhost:3001 | use-inbox.ts |
| NEXT_PUBLIC_EVO_INSTANCE_NAME | No | mantra_instance | whatsapp hooks |
| NEXT_PUBLIC_ENABLE_DEVTOOLS | No | false | providers/query |
| NEXT_PUBLIC_ENABLE_MOCK_DATA | No | false | lib/mock-data |

### Backend (Server-Only) - Critical Secrets
| Variable | Required | Used In | Validation |
|----------|----------|---------|------------|
| JWT_SECRET | Yes | auth.ts, proxy.ts | Min 16 chars |
| DATABASE_URL | Yes | database/postgres.go | Valid PostgreSQL URL |
| REDIS_URL | Yes | database/redis.go | Valid Redis URL |
| EVO_API_KEY | Yes | services/evolution.go | Non-empty |
| EVO_API_URL | Yes | services/evolution.go | Valid URL |
| HERMES_AUTH_TOKEN | Yes | services/ai_fallback.go | Non-empty |
| FRONTEND_URL | Yes | CORS config | Valid URL |

---

## 8. Integration Points

### Evolution API Integration
**Base URL**: `EVO_API_URL` (env-configured)
**Auth**: Header `apikey: EVO_API_KEY`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| /instance/create | POST | Provision new WA instance |
| /instance/delete/:name | DELETE | Remove instance |
| /instance/logout/:name | DELETE | Disconnect WA |
| /instance/connectionState/:name | GET | Get connection status |
| /instance/connect/:name | GET | Get QR code (base64) |
| /message/sendText/:name | POST | Send message |

**Webhook Payload** ( Evolution → Go Backend ):
```json
{
  "event": "messages.upsert",
  "instanceName": "mantra_instance",
  "data": {
    "key": { "remoteJid": "628123456789@s.whatsapp.net" },
    "message": { "conversation": "Hello" },
    "messageTimestamp": 1234567890
  }
}
```

### AI Provider Integration
**Supported Providers**: OpenAI, Groq, OpenRouter
**Fallback Chain**: ai_providers.priority ASC → Try until success
**Request Format** (OpenAI-compatible):
```json
{
  "model": "gpt-4",
  "messages": [
    {"role": "system", "content": "system_prompt"},
    {"role": "user", "content": "customer_message"}
  ],
  "temperature": 0.7
}
```

---

## 9. Security Architecture

### Authentication
- **Method**: JWT (HS256), HTTP-only cookies
- **Session Cookie**: `mantra_session`
- **Expiration**: 24 hours (configurable)
- **Middleware**: proxy.ts validates on every request

### Authorization (Role-Based)
| Route | SUPER_ADMIN | CLIENT_ADMIN | STAFF |
|-------|-------------|--------------|-------|
| / (Dashboard) | ✓ | ✓ | ✓ |
| /ai-hub | ✓ | ✓ | ✓ |
| /whatsapp | ✓ | ✓ | ✗ |
| /inbox | ✓ | ✓ | Read-only |
| /tenants | ✓ | ✓ | Read-only |
| /diagnosis | ✓ | ✗ | ✗ |
| /settings | ✓ | ✗ | ✗ |

### Security Headers (via proxy.ts)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: strict-origin-when-cross-origin`

### XSS Prevention
- `lib/sanitize.ts` - DOMPurify wrapper
- All inbox messages sanitized before render

---

## 10. Docker Compose Services

| Service | Image | Memory | Dependencies |
|---------|-------|--------|--------------|
| postgres | postgres:15-alpine | 512MB | - |
| redis | redis:7-alpine | 256MB | - |
| evolution | atendai/evolution-api:latest | 1GB | postgres, redis |
| backend | (Dockerfile build) | 256MB | postgres, redis |
| frontend | (Dockerfile build) | 256MB | backend |

**Total RAM Budget**: < 2.6 GB

---

## 11. Deployment Environments

### Development (Local)
```
Frontend: http://localhost:5000
Backend:  http://localhost:3001
Database: localhost:5432
Redis:    localhost:6379
Evolution: localhost:8080
```

### Production (VPS via Cloudflare Tunnel)
```
Public URL: https://api.mantra.yourdomain.com (backend)
Public URL: https://app.mantra.yourdomain.com (frontend)
Internal:   Docker network (service names)
```

---

## 12. Key Files Reference

### Frontend (Next.js)
| File | Purpose |
|------|---------|
| `app/layout.tsx` | Root layout, providers |
| `app/page.tsx` | Dashboard overview |
| `middleware.ts` | Route protection (legacy, see proxy.ts) |
| `proxy.ts` | Current middleware implementation |
| `lib/config.ts` | Centralized env config |
| `lib/env.ts` | Zod env validation |
| `lib/api-client.ts` | Typed fetch wrapper |
| `hooks/use-*.ts` | Data fetching hooks |

### Backend (Go)
| File | Purpose |
|------|---------|
| `main.go` | Entry point, Fiber setup |
| `config/config.go` | Env loading, validation |
| `database/postgres.go` | PostgreSQL connection |
| `database/redis.go` | Redis connection |
| `services/evolution.go` | Evolution API client |
| `services/ai_fallback.go` | AI provider chain |
| `handlers/*.go` | HTTP handlers |
| `routes/routes.go` | Route registration |
| `ws/hub.go` | WebSocket hub |

---

## 13. Development Guidelines

### Adding New Environment Variables
1. Add to `.env` (local) and `.env.example` (template)
2. Add to `lib/env.ts` (Zod schema)
3. Add to `lib/config.ts` (runtime access)
4. Add to `backend/config/config.go` (Go access)
5. Add validation in `validateRequired()` for production
6. Update this ARCHITECTURE.md

### Adding New API Endpoints
1. Go backend: Add handler in `handlers/`
2. Go backend: Register in `routes/routes.go`
3. Frontend: Add hook in `hooks/use-*.ts`
4. Frontend: Update `lib/types.ts` with TypeScript interfaces

### Security Checklist
- [ ] No `process.env.*` in client components (use NEXT_PUBLIC_* only)
- [ ] All server env vars accessed via `serverConfig` or `serverEnv`
- [ ] All database queries parameterized (GORM/pg auto-escapes)
- [ ] All user input sanitized (lib/sanitize.ts)
- [ ] JWT_SECRET >= 32 characters in production
- [ ] HTTPS only in production (Cloudflare Tunnel)

---

## 14. Known Limitations & TODOs

| Issue | Location | Status |
|-------|----------|--------|
| Hardcoded default passwords | init.sql:159-161 | Documented, dev-only |
| Direct process.env in auth.ts | lib/auth.ts:16,58 | Refactor to serverConfig |
| Direct process.env in proxy.ts | proxy.ts:14,25 | Refactor to serverConfig |
| No rate limiting | backend | TODO |
| No request logging | backend | Basic Fiber logger only |

---

## 15. Emergency Contacts & Resources

- **Evolution API Docs**: https://doc.evolution-api.com/
- **Go Fiber Docs**: https://docs.gofiber.io/
- **Next.js App Router**: https://nextjs.org/docs/app
- **TanStack Query**: https://tanstack.com/query/latest

---

*This document is the single source of truth for the Mantra AI architecture. Update when making structural changes.*
