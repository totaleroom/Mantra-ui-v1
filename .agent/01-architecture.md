# 01 — Architecture Mental Model

## One-paragraph summary

Mantra runs **5 services on one VPS**, orchestrated by Coolify + Traefik:
PostgreSQL 15 holds all durable state, Redis 7 caches transient memory and
session data, Evolution API (Baileys wrapper) is the WhatsApp gateway, a Go
Fiber backend owns business logic and exposes HTTP + WebSocket, and a Next.js
16 frontend renders the dashboard. The frontend talks to the Go backend over
HTTP/WS; the Go backend talks to Evolution, Postgres, Redis, and external AI
providers (OpenAI / Groq / OpenRouter). There is **no other service**.

## Service map

```
         ┌────────────────── VPS (Debian 12, 4 GB RAM) ─────────────────┐
         │                                                              │
Browser ─┤→ Traefik ─┬→ Next.js frontend :5000 ──HTTP──┐                │
  HTTPS  │           │                                 ▼                │
         │           └→ Go backend    :3001 ───SQL───→ Postgres :5432   │
         │                │  │   │    └─Redis────────→ Redis    :6379   │
         │                │  │   └───HTTP────────────→ Evolution :8080 ─┼→ WhatsApp
Customer │                │  │                                          │
  phone ─┼→ Evolution :8080 (webhook in) ─POST─→ Go backend /api/webhooks/evolution
         │                ▼                                              │
         │         3rd-party AI APIs (OpenAI, Groq, OpenRouter)          │
         └──────────────────────────────────────────────────────────────┘
```

Only `:5000` (frontend) and `:3001` (backend) are reachable from the internet
via Traefik. Everything else is container-internal.

## Canonical message flow

This is the **single most important diagram** in the project. Know it cold.

```
Customer sends "Halo" to tenant's WhatsApp number
  │
  ▼
Evolution receives message → POSTs to our backend
  POST {PUBLIC_BACKEND_URL}/api/webhooks/evolution
  Header: X-Webhook-Secret: {WEBHOOK_SECRET}
  │
  ▼
backend/handlers/webhooks.go :: EvolutionWebhook()
  1. Auth: constant-time compare of X-Webhook-Secret
  2. Parse MESSAGES_UPSERT envelope
  3. Skip echoes (fromMe=true) and non-text (stickers, media, etc.)
  4. Extract text, instance name, E.164 customer number, provider msg ID
  5. Hand off to orchestrator in a goroutine
  6. Return 200 immediately (Evolution expects fast ack)
  │
  ▼
backend/services/orchestrator.go :: HandleInbound()
  1. Resolve instanceName → WhatsAppInstance → Client
  2. Gate: client active? token budget left? idempotency guard on msg ID.
  3. Persist InboxMessage{direction=inbound} → triggers WS broadcast
  4. Load ClientAIConfig (systemPrompt, temperature, memoryTtlDays)
  5. Load CustomerMemory from Redis (fallback Postgres) — last 10 turns
  6. Build conversation: [system, ...history, {user: inboundText}]
  7. Call AIFallbackService.Chat — providers tried in priority order,
     failover on error
  8. EvolutionService.SendText(instance, to, replyText)
  9. Persist InboxMessage{direction=outbound} → WS broadcast
 10. Upsert CustomerMemory with new turn; bump Client.TokenBalance
  │
  ▼
Dashboard inbox page receives both messages via /api/inbox/live WebSocket
```

**Manual reply path** (dashboard "Send" button):

```
ReplyComposer (React) → POST /api/whatsapp/instances/:id/send
                      → Orchestrator.SendManual()
                      → EvolutionService.SendText()
                      → Persist outbound → WS broadcast
```

## Concurrency model

- **Fiber backend** is goroutine-per-request (standard Go).
- **Webhook handler** returns 200 immediately; heavy work runs in `go func()`.
- **InboxHub** (`backend/ws/inbox_ws.go`) is a classic hub: one goroutine
  fans out `chan models.InboxMessage` to subscriber connections per tenant.
- **Orchestrator hook** — `main.go` wires `orchestrator.OnMessagePersisted`
  to `InboxHub.BroadcastMessage`. This avoids import cycles between
  `services/` and `ws/`.

## State ownership

| State | Owner | Notes |
|-------|-------|-------|
| Users, Clients, Instances, Messages, AIConfig, AIProvider | Postgres | GORM models in `backend/models/` |
| CustomerMemory (active) | Redis (primary), Postgres (fallback+TTL enforcement) | `services/memory.go` |
| Session (JWT) | HttpOnly cookie on browser | No server-side session store |
| WhatsApp connection state | Evolution API | We only cache last-known in Postgres |

## Auth model

- **Cookie-based JWT** (HS256, 8 h expiry, HttpOnly, Secure in prod).
- **Roles**: `SUPER_ADMIN` > `CLIENT_ADMIN` > `STAFF`.
- Middleware: `backend/middleware/auth.go` validates + attaches claims to
  context. Next.js middleware (`middleware.ts`) mirrors this for SSR pages.
- **Dev-only bypass**: if `DEV_AUTH_BYPASS=true`, `lib/auth.ts` issues a
  locally-signed JWT matching a hardcoded dev user — no backend call needed.
  Used for UI preview. **Never enabled in production.**

## External dependencies we depend on

| Dep | What we use it for | Failure mode |
|-----|-------------------|--------------|
| Evolution API | Send/receive WhatsApp, QR generation | No delivery → we retry N/A, manual intervention needed |
| OpenAI / Groq / OpenRouter | LLM chat completions | Fallback chain: first healthy provider wins |
| Postgres | Durable state | Backend refuses to start without it |
| Redis | Memory cache, rate-limit | Memory service falls back to Postgres |

## What we deliberately do NOT have (yet)

- Queue/worker (BullMQ, NATS). Goroutines are enough at MVP scale (1–5 tenants).
- Separate media handling (we skip non-text messages outright).
- Analytics pipeline.
- Multi-region / HA. Single VPS is the deployment target.
- OAuth / SSO. Email+password only.
