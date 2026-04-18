# 01 — Architecture Mental Model

> **Companion reference:** [`ARCHITECTURE.md`](../ARCHITECTURE.md) is the
> deep public-facing architecture doc (tech stack, network topology, DB
> schema, security posture). This file stays short and opinionated —
> what an AI agent actually needs to hold in working memory.

## One-paragraph summary

Mantra runs **5 services on one VPS**, orchestrated by Coolify + Traefik:
PostgreSQL 15 with **pgvector** holds all durable state (including
per-tenant knowledge-base chunks + embeddings), Redis 7 caches transient
memory and session data, Evolution API (Baileys wrapper) is the WhatsApp
gateway, a Go Fiber backend owns business logic + a tool-calling loop
and exposes HTTP + WebSocket, and a Next.js 16 frontend renders the
dashboard. The frontend talks to the Go backend over HTTP/WS; the Go
backend talks to Evolution, Postgres, Redis, external AI providers
(OpenAI / Groq / OpenRouter), and (Phase 4) per-tenant **webhook tools**
hosted by the tenant. There is **no other service we run**.

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
  6. buildConversation:
       a. Start from system prompt
       b. Phase 3 RAG — retrieval.Retrieve(clientID, text, topK=4):
          • FAQ match: trigger_keywords/tags ∩ tokens, priority DESC
          • Vector match: embed text → ORDER BY embedding <=> :vec
          • Compose [KNOWLEDGE] block → append to system prompt
          • Return RetrievedContext{Blob, FAQIDs, ChunkIDs, Provider}
       c. Prepend history (last N turns from CustomerMemory)
       d. Append {user: inboundText}
  7. runReplyLoop (Phase 4 tool calling, max 3 iterations):
       a. tools.LoadToolsForClient(clientID) → []ToolDefinition
       b. Call AIFallbackService.ChatWithTools(messages, tools)
       c. If response has no tool_calls → terminal reply → exit loop
       d. Else for each tool_call: ToolService.Execute
          (builtin Go func OR webhook POST with 8 KiB cap, SSRF block)
          → append role="tool" message → loop
       e. On iter == MaxToolIterations, tools=nil to force reply.
  8. EvolutionService.SendText(instance, to, replyText)
  9. Persist InboxMessage{direction=outbound} with
     ai_thought_process = JSON{retrievedFaqs, retrievedChunks,
     embedProvider, toolCalls} → WS broadcast
 10. Upsert CustomerMemory with new turn; bump Client.TokenBalance
  │
  ▼
Dashboard inbox page receives both messages via /api/inbox/live WebSocket.
The ThoughtProcessPanel renders the audit JSON so operators can see what
retrieval + tool calls the AI made.
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
| Users, Clients, Instances, Messages, AIConfig, AIProvider | Postgres | GORM models in `backend/models/models.go` |
| CustomerMemory (active) | Redis (primary), Postgres (fallback+TTL enforcement) | `services/memory.go` |
| Knowledge chunks + embeddings (Phase 2) | Postgres (`client_knowledge_chunks`) | pgvector(1536); HNSW index for ANN |
| Structured FAQs (Phase 2) | Postgres (`client_faqs`) | JSONB tags/keywords; GIN index |
| Tool definitions (Phase 4) | Postgres (`client_tools`) | JSONB parameters_schema + handler_config |
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
- Tiered model routing (Phase 5 — planned).
- Rate limiting, structured logging, automated backups, human handoff
  (Phase 6 — planned). See `.agent/10-commercial-mvp-roadmap.md`.

## What we DO have now (Phase 2–4 shipped)

- Per-tenant Knowledge Base (chunks + FAQs) with RAG injected into the
  system prompt by `buildConversation`.
- AI function calling: per-tenant tool registry (`client_tools`),
  max 3 iterations per inbound message, both builtin (Go func) and
  webhook (tenant URL) handlers.
- Audit trail: every outbound message's `ai_thought_process` column
  contains the JSON-encoded retrieval + tool-call trace for that turn.
