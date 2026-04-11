# Handover Manifest - Mantra AI Frontend

> Final Integration Summary for Backend Developers and Hermes Agent

**Version:** 2.0 Production Ready  
**Generated:** April 2026  
**Frontend Status:** Complete and deployed on Vercel

---

## 1. Routes Created

| Route | Component | Purpose | Access Level |
|-------|-----------|---------|--------------|
| `/` | `app/page.tsx` | Dashboard overview with live stats | All authenticated |
| `/ai-hub` | `app/ai-hub/page.tsx` | AI Provider management with fallback logic | All authenticated |
| `/whatsapp` | `app/whatsapp/page.tsx` | WhatsApp Gateway (Evolution API bridge) | All authenticated |
| `/inbox` | `app/inbox/page.tsx` | Omniscient Inbox with real-time updates | All authenticated |
| `/tenants` | `app/tenants/page.tsx` | Tenant list with search/filter | All authenticated |
| `/tenants/[id]` | `app/tenants/[id]/page.tsx` | Per-tenant AI config, RAG, memory settings | All authenticated |
| `/diagnosis` | `app/diagnosis/page.tsx` | System health monitoring | SUPER_ADMIN only |
| `/settings` | `app/settings/page.tsx` | Global configuration | SUPER_ADMIN only |

**Total Routes: 8**

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

## 4. Critical Instructions for Hermes Agent

### Pre-Deployment Checklist

1. **VPS Requirements**
   - Debian 12 with Docker & Docker Compose installed
   - Minimum 4GB RAM (2.5GB allocated to services)
   - Open ports: 22 (SSH), 80/443 (via Cloudflare Tunnel)

2. **Services to Deploy**
   ```yaml
   # RAM Allocation (Total: ~2.5GB for 4GB VPS)
   postgres:     512MB
   redis:        256MB
   evolution:    1GB
   go-backend:   256MB
   cloudflared:  64MB
   ```

3. **Cloudflare Tunnel Setup**
   - Create tunnel: `cloudflared tunnel create mantra-api`
   - Configure DNS: `api.mantra.yourdomain.com` → tunnel
   - Enable WebSocket support in tunnel config

4. **Environment Variables (VPS)**
   ```bash
   # Database
   POSTGRES_USER=mantra
   POSTGRES_PASSWORD=<generate-secure-password>
   POSTGRES_DB=mantra_db
   
   # Redis
   REDIS_URL=redis://redis:6379
   
   # Evolution API
   EVOLUTION_API_URL=http://evolution:8080
   EVOLUTION_API_KEY=<generate-secure-key>
   
   # Go Backend
   JWT_SECRET=<generate-secure-secret>
   CORS_ORIGINS=https://your-vercel-app.vercel.app
   ```

5. **Post-Deployment Verification**
   ```bash
   # Test API health
   curl https://api.mantra.yourdomain.com/health
   
   # Test WebSocket
   wscat -c wss://api.mantra.yourdomain.com/api/inbox/live
   ```

### Deployment Order

1. Start PostgreSQL, wait for healthy
2. Run database migrations (`docs/schema.ts`)
3. Start Redis
4. Start Evolution API
5. Start Go Backend
6. Configure Cloudflare Tunnel
7. Update Vercel environment variables
8. Verify frontend connectivity

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

## 6. Files Modified in Final Polish

| File | Changes |
|------|---------|
| `middleware.ts` | Route protection, security headers, RBAC |
| `lib/sanitize.ts` | XSS prevention utilities |
| `components/dashboard/sidebar.tsx` | Mobile Sheet drawer navigation |
| `components/inbox/message-card.tsx` | Content sanitization |
| `app/inbox/page.tsx` | Mobile-responsive, skeleton loading |
| `app/tenants/page.tsx` | Responsive table/card view |
| `components/whatsapp/qr-code-dialog.tsx` | Responsive, base64 support |
| `README.md` | Comprehensive documentation |

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
