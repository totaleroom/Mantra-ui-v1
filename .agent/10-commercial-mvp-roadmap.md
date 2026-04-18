# 10 — Commercial MVP Roadmap

> **Single source of truth** for the product path from "functional WhatsApp
> bot" to "commercial MVP we can sell to paying tenants". Each phase has
> deliverables, files touched, and verification steps. Update status as each
> phase completes.

---

## Vision

Mantra AI is a **multi-tenant WhatsApp AI customer-service platform** where
each tenant gets:

- A dedicated WhatsApp number (Evolution instance)
- A configurable AI persona (system prompt + tone + temperature)
- A **private knowledge base** (FAQs + uploaded documents, RAG-retrieved)
- A **tool-calling layer** so AI can check DB: stock, orders, user data
- A **tiered model router** (cheap model first, escalate to premium on
  uncertainty or complexity)
- A **human handoff** path when AI confidence is low
- Per-tenant analytics (resolution rate, cost, CSAT)

One VPS, < 3 GB RAM, 1-5 paying tenants at first scale. Expands to 20-50
tenants on same topology with tier upgrades.

---

## Phase Progress

| Phase | Title | Status | Est. Hours |
|-------|-------|--------|------------|
| 0 | Baseline foundation (Next.js + Go + Postgres + Redis + Evolution) | ✅ Done | — |
| 1 | Visual polish (Apple × Nothing OS) | 🟡 Partial (Tier 1 done, per-page audit pending) | 3-4 |
| 2 | Knowledge Base foundation (pgvector + KB tables + UI) | ✅ Done | 8-12 |
| 3 | RAG integration to orchestrator | ✅ Done | 4-6 |
| 4 | Tool calling (function calling + DB tools) | ✅ Done | 10-14 |
| 5 | Tiered model routing (cheap → escalate) | ⚪ Planned | 4-6 |
| 6 | Production hardening (rate limit + logs + backup + handoff) | ⚪ Planned | 6-8 |

Total estimate: **35-50 focused hours** beyond baseline.

---

## Phase 2 — Knowledge Base Foundation (current)

### Goal
Each tenant can upload FAQs and knowledge documents. System embeds them
and makes them retrievable by the AI orchestrator via cosine similarity.
No RAG wiring yet — just storage, CRUD, embedding pipeline.

### Deliverables

**Database**
- `pgvector` extension installed in Postgres
- `client_knowledge_chunks` table — vector(1536) + content + metadata
- `client_faqs` table — structured Q&A per tenant
- Indices for fast client-scoped retrieval (HNSW on embedding, B-tree on client_id)

**Backend (Go)**
- `backend/models/knowledge.go` — `KnowledgeChunk`, `FAQ` structs
- `backend/services/embedding.go` — embedding client (OpenAI-compat)
- `backend/handlers/knowledge.go` — REST CRUD:
  - `POST   /api/clients/:id/knowledge/chunks` — upload text, chunks + embeds
  - `GET    /api/clients/:id/knowledge/chunks` — list paginated
  - `DELETE /api/clients/:id/knowledge/chunks/:chunkId`
  - `POST   /api/clients/:id/knowledge/faqs` — create FAQ
  - `GET    /api/clients/:id/knowledge/faqs`
  - `PATCH  /api/clients/:id/knowledge/faqs/:faqId`
  - `DELETE /api/clients/:id/knowledge/faqs/:faqId`
  - `GET    /api/clients/:id/knowledge/stats` — counts + last ingest timestamp
- Route registration in `backend/routes/routes.go`

**Frontend (Next.js)**
- `app/tenants/[id]/knowledge/page.tsx` — main KB dashboard
  - Tabs: "Documents" (chunks list) | "FAQ" (editable Q&A)
  - Upload textarea (paste large text, optional source label)
  - FAQ form + inline edit
  - Stats card (total chunks, last ingest, total FAQs)
- Hooks `hooks/use-knowledge.ts` — React Query for CRUD
- API route proxies in `app/api/clients/[id]/knowledge/...`

**Infrastructure**
- `docker-compose.yaml` — swap `postgres:15-alpine` → `pgvector/pgvector:pg15`
- `.env.example` — document `OPENAI_EMBEDDING_API_KEY` (can reuse existing
  OpenAI key; embedding endpoint is on same provider)

### Not in Phase 2 (deferred to Phase 3)

- Retrieval inside orchestrator (just storage this phase)
- PDF parsing (text-only upload for now)
- Hybrid search (vector-only, add BM25 later)
- Reindexing on prompt change

### Verification

- `docker compose up -d postgres` (fresh) → extension created, tables created
- `curl POST /api/clients/1/knowledge/chunks` with text body → returns chunk IDs
- Query Postgres: `SELECT count(*) FROM client_knowledge_chunks WHERE client_id=1` → non-zero
- Frontend: upload text → chunks appear in list → delete one → it's gone
- TS + Go build clean

---

## Phase 3 — RAG Integration (next)

### Goal
Orchestrator retrieves top-K relevant chunks + relevant FAQs for each
inbound message, injects them as context into the AI prompt, tracks what
was retrieved for observability.

### Deliverables

- `backend/services/orchestrator.go::buildConversation` — extended with
  retrieval step before building `messages`
- `backend/services/retrieval.go` — new: takes (clientID, query) →
  returns top-K chunks + matching FAQs
- Prompt template that slots retrieved context cleanly (system prompt
  stays clean; retrieved context sits in a dedicated `[KNOWLEDGE]` block)
- Log retrieved chunk IDs to `inbox_messages.ai_thought_process` for
  observability (already a field in the schema)
- Benchmark: retrieval should add < 200ms p95 to pipeline

### Verification

- Seed KB for test client with known FAQs
- Send WhatsApp test message with known keyword → AI reply includes
  retrieved info
- `SELECT ai_thought_process FROM inbox_messages` shows which chunks
  were used

---

## Phase 4 — Tool Calling

### Goal
Configurable per-tenant tools that AI can invoke. Example tools:
`check_stock(sku)`, `get_order_status(order_id)`, `lookup_customer(phone)`.
Each tool has a definition (schema) and a handler (SQL or HTTP call).

### Tech notes
- Use OpenAI function-calling shape (supported by OpenAI, Groq, many
  OpenRouter models, Together, Fireworks). Fallback for providers
  without it: parse structured output from model.
- Store tool definitions in `client_tools` table (name, JSON schema,
  backend handler reference).
- Sandboxed execution: tools never run arbitrary user code — they call
  predefined Go functions that take the tool args and return JSON.
- Audit every tool execution in `tool_executions` table.

---

## Phase 5 — Tiered Model Routing

### Goal
Reduce cost by using a cheap model (Gemini Flash Lite / DeepSeek V3 /
Groq Llama 3.3 70B) for simple queries, escalating to a smarter model
only when needed.

### Approach
- Router model: small classifier (could be the cheap model itself
  prompted to output "simple" | "complex" | "escalate-to-human").
- `ClientAIConfig` extended: `cheap_model_id`, `premium_model_id`,
  `escalation_triggers` JSONB (keywords, sentiment cues, confidence).
- Per-tenant cost tracking.

---

## Phase 6 — Production Hardening

### Goal
Turnkey for commercial use.

### Deliverables
- Rate limit per customer number (reject > N messages / minute)
- Sentry integration (or self-hosted GlitchTip)
- Structured logging (`log/slog`) with JSON output
- Automated Postgres backup (pg_dump → S3/R2 daily)
- Handoff-to-human: conversation flag + notification to operator
- Onboarding wizard: new tenant setup in < 5 minutes (brand, tone, KB)
- Audit log: who changed what, when (already have model stub —
  `AuditLog` — needs wiring)

---

## How we track progress

- Every PR that implements a phase deliverable references its phase number
- `07-task-log.md` gets an entry summarizing what shipped per session
- This file's phase-status table updated at session boundary
- If a deliverable is descoped, update this file BEFORE starting next
  phase — never silently drop scope
