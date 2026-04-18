# Mantra AI — Database Schema Reference

> **Engine:** PostgreSQL 15+ with **`pgvector`** extension (image `pgvector/pgvector:pg15`)  
> **DDL source of truth:** [`backend/database/init.sql`](../backend/database/init.sql)  
> **Drizzle TS mirror:** [`docs/schema.ts`](./schema.ts)

Apply DDL on a fresh database:

```bash
psql "$DATABASE_URL" -f backend/database/init.sql
```

The DDL is **idempotent** (uses `CREATE TABLE IF NOT EXISTS`, `DO $$ ... duplicate_object`, `CREATE EXTENSION IF NOT EXISTS`), safe to re-run.

## Required PostgreSQL Extensions

| Extension | Purpose | Created by |
|-----------|---------|------------|
| `pgcrypto` | `gen_random_uuid()`, hash helpers | init.sql |
| `vector` (pgvector) | Semantic search over KB chunks (HNSW index) | init.sql (requires pgvector image) |

---

## Entity Relationship Overview

```
                ┌──────────┐
                │  users   │  (auth principals — not tenant-scoped)
                └──────────┘

┌──────────┐    ┌────────────────────────────┐
│ clients  │◄───│ ai_providers             │  (N per client; client_id NULL = global)
│ (tenant) │    └───────────────────────────┘
│          │◄───│ client_ai_configs        │  (1:1 — persona & base prompt)
│          │◄───│ whatsapp_instances       │  (N WhatsApp connections)
│          │◄───│ customer_memories        │  (TTL 4 days, per-customer history)
│          │◄───│ inbox_messages           │  (all chat messages + ai_thought_process)
│          │◄───│ client_knowledge_chunks  │  ★ Phase 2 RAG — vector(1536) + content
│          │◄───│ client_faqs              │  ★ Phase 2 — structured Q&A + tags
│          │◄───│ client_tools             │  ★ Phase 4 — AI function-calling registry
└──────────┘

                ┌───────────────────┐
                │ system_diagnoses  │  (standalone health log)
                └───────────────────┘
```

---

## Enums

| Type | Values |
|------|--------|
| `user_role` | `SUPER_ADMIN`, `CLIENT_ADMIN`, `STAFF` |
| `instance_status` | `CONNECTED`, `CONNECTING`, `DISCONNECTED`, `ERROR` |
| `whatsapp_provider_type` | `WHATSAPP_WEB_JS` |

---

## Tables

### 1. `users` — Authentication principals

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | `BIGSERIAL` | no | auto | PK |
| `email` | `TEXT` | no | — | UNIQUE; login identifier |
| `password` | `TEXT` | no | — | bcrypt hash (cost 10) |
| `role` | `user_role` | no | `CLIENT_ADMIN` | RBAC |
| `created_at` | `TIMESTAMPTZ` | no | `NOW()` | — |

**Indexes:** `idx_users_email(email)`

**Bootstrap rows** (inserted only if `users` is empty — see `init.sql` §170):

| Email | Password | Role |
|-------|----------|------|
| `admin@mantra.ai` | `MantraAdmin2024!` | `SUPER_ADMIN` |
| `demo@mantra.ai` | `admin123` | `CLIENT_ADMIN` |

> ⚠️ Change immediately after first login in production.

---

### 2. `clients` — Tenants

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | `BIGSERIAL` | auto | PK |
| `name` | `TEXT` | — | Company / UMKM name |
| `token_balance` | `INTEGER` | `0` | Consumed AI tokens |
| `token_limit` | `INTEGER` | `1000` | Monthly quota |
| `is_active` | `BOOLEAN` | `TRUE` | Soft disable |
| `created_at` | `TIMESTAMPTZ` | `NOW()` | — |

---

### 3. `ai_providers` — LLM credentials & fallback chain

| Column | Type | Notes |
|--------|------|-------|
| `id` | `BIGSERIAL` | PK |
| `client_id` | `BIGINT` | FK → `clients.id` ON DELETE SET NULL. `NULL` = global provider |
| `provider_name` | `TEXT` | e.g. `"OpenAI"`, `"Groq"`, `"OpenRouter"` |
| `api_key` | `TEXT` | Stored plaintext — encrypt at rest in production |
| `base_url` | `TEXT` | OpenAI-compatible endpoint |
| `priority` | `INTEGER` | Lower = tried first |
| `is_active` | `BOOLEAN` | Toggle without delete |
| `last_error` | `TEXT` | Populated on failure |
| `updated_at` | `TIMESTAMPTZ` | `NOW()` |

**Indexes:** `idx_ai_providers_client_id`, `idx_ai_providers_priority`

**Fallback strategy** (`backend/services/ai_fallback.go`): sort `WHERE is_active = TRUE` by `priority ASC`, attempt in order, record `last_error` on failure.

---

### 4. `client_ai_configs` — Persona & knowledge per tenant

| Column | Type | Constraint |
|--------|------|------------|
| `id` | `BIGSERIAL` | PK |
| `client_id` | `BIGINT` | UNIQUE, FK → `clients.id` ON DELETE CASCADE |
| `model_id` | `TEXT` | e.g. `"gpt-4-turbo"` |
| `system_prompt` | `TEXT` | Persona instructions (10-4000 chars recommended) |
| `vector_namespace` | `TEXT` | Optional pgvector namespace |
| `temperature` | `NUMERIC(3,2)` | default `0.70`; CHECK 0-2 |
| `memory_ttl_days` | `INTEGER` | default `4`; CHECK 1-4 |

---

### 5. `whatsapp_instances` — Gateway connections

| Column | Type | Notes |
|--------|------|-------|
| `id` | `BIGSERIAL` | PK |
| `client_id` | `BIGINT` | FK → `clients.id` ON DELETE CASCADE |
| `instance_name` | `TEXT` | UNIQUE; passed to Evolution API |
| `instance_api_key` | `TEXT` | Per-instance key from Evolution |
| `webhook_url` | `TEXT` | Where Evolution posts events |
| `provider_type` | `whatsapp_provider_type` | default `WHATSAPP_WEB_JS` |
| `provider_config` | `JSONB` | default `{}` — provider-specific settings |
| `status` | `instance_status` | default `DISCONNECTED` |
| `updated_at` | `TIMESTAMPTZ` | `NOW()` |

**Indexes:** `idx_whatsapp_instances_client_id`, `_instance_name`, `_provider_type`

---

### 6. `customer_memories` — Transient chat memory (4-day TTL)

| Column | Type | Notes |
|--------|------|-------|
| `id` | `BIGSERIAL` | PK |
| `client_id` | `BIGINT` | FK → `clients.id` ON DELETE CASCADE |
| `customer_number` | `TEXT` | E.164 format (`+628123…`) |
| `summary` | `TEXT` | Rolling AI-generated summary |
| `raw_history` | `JSONB` | Recent message array |
| `expires_at` | `TIMESTAMPTZ` | Row purged after this time |
| `updated_at` | `TIMESTAMPTZ` | `NOW()` |

**Unique:** `(client_id, customer_number)` — one memory row per customer per tenant.  
**Indexes:** `idx_customer_memories_client_number`, `_expires_at`

Redis mirrors hot entries for sub-10ms read; Postgres is the durable store (`backend/services/memory.go`).

---

### 7. `inbox_messages` — All inbound/outbound chat events

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT` | PK — Evolution message ID |
| `client_id` | `BIGINT` | FK → `clients.id` ON DELETE CASCADE |
| `customer_number` | `TEXT` | E.164 |
| `message` | `TEXT` | Raw message body |
| `direction` | `TEXT` | CHECK IN (`inbound`, `outbound`) |
| `timestamp` | `TIMESTAMPTZ` | Event time (not insert time) |
| `ai_thought_process` | `TEXT` | Debug field — AI reasoning |
| `model_used` | `TEXT` | e.g. `"gpt-4-turbo"` |

**Indexes:** `idx_inbox_messages_client_id`, `_timestamp (DESC)`, `_direction`

---

### 8. `client_knowledge_chunks` — RAG document storage (Phase 2)

Per-tenant embedded text chunks for semantic retrieval. Populated via
`POST /api/clients/:id/knowledge/chunks` (text is chunked + embedded via
the OpenAI-compatible `/embeddings` endpoint of the first non-Groq
provider).

| Column | Type | Notes |
|--------|------|-------|
| `id` | `BIGSERIAL` | PK |
| `client_id` | `BIGINT` | FK → `clients.id` ON DELETE CASCADE — strict tenant isolation |
| `content` | `TEXT` | The chunk text the LLM will see |
| `embedding` | `vector(1536)` | pgvector — matches OpenAI `text-embedding-3-small` |
| `source` | `TEXT` | Free-form origin tag (e.g. `"manual-paste"`, `"product-catalog.pdf"`) |
| `category` | `TEXT` | Optional grouping (e.g. `"shipping"`, `"pricing"`) |
| `metadata` | `JSONB` | default `{}` — arbitrary tenant-supplied keys |
| `token_count` | `INTEGER` | Approximate tokens (for budgeting) |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | `NOW()` |

**Indexes:**
- `idx_knowledge_chunks_client_id` — B-tree on `client_id` (every query is client-scoped)
- `idx_knowledge_chunks_embedding_hnsw` — **HNSW** index using `vector_cosine_ops` for fast ANN search (built lazily; DO block skips gracefully if pgvector missing)

**Retrieval** (`backend/services/retrieval.go::Retrieve`): embeds the
inbound message once, then `ORDER BY embedding <=> $1 LIMIT N`. Swap
dimension when changing embedding model — re-embed existing rows.

---

### 9. `client_faqs` — Structured Q&A (Phase 2)

Human-authored, editable, matched FIRST (before vector retrieval) because
exact-match Q&A is higher quality than semantic similarity for
well-known questions.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `BIGSERIAL` | PK |
| `client_id` | `BIGINT` | FK → `clients.id` ON DELETE CASCADE |
| `question` | `TEXT` | Question as the customer might ask it |
| `answer` | `TEXT` | Answer the AI should use verbatim or paraphrase |
| `tags` | `JSONB` | Default `[]` — e.g. `["shipping", "jakarta"]` |
| `priority` | `INTEGER` | Higher = shown first |
| `is_active` | `BOOLEAN` | Toggle without delete |
| `trigger_keywords` | `JSONB` | Default `[]` — exact/fuzzy match against inbound text |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | `NOW()` |

**Indexes:**
- `idx_faqs_client_id` — B-tree on `client_id`
- `idx_faqs_active_priority` — composite `(client_id, is_active, priority DESC)` for the retrieval hot path
- `idx_faqs_tags_gin` — **GIN (`jsonb_path_ops`)** on `tags` for `WHERE tags @> '"shipping"'::jsonb`

Why JSONB arrays instead of `TEXT[]`? GORM has native `serializer:json`
support without the extra `pgarray` dependency.

---

### 10. `client_tools` — AI function-calling registry (Phase 4)

Per-tenant tool definitions the AI can invoke during a conversation.
The orchestrator feeds `[]ToolDefinition` to the LLM via
`ChatWithTools`, dispatches any `tool_calls` through
`backend/services/tools.go::Execute`, and feeds the JSON result back in
as a `role: "tool"` message. Max 3 iterations per inbound message.

| Column | Type | Notes |
|--------|------|-------|
| `id` | `BIGSERIAL` | PK |
| `client_id` | `BIGINT` | FK → `clients.id` ON DELETE CASCADE |
| `name` | `TEXT` | snake_case; the LLM sees this as the function name |
| `description` | `TEXT` | Plain English — the LLM reads this to decide when to call |
| `parameters_schema` | `JSONB` | JSON Schema object (OpenAI function-calling format) |
| `handler_type` | `TEXT` | `'builtin'` or `'webhook'` |
| `handler_config` | `JSONB` | `{name: string}` for builtin; `{url, secret?}` for webhook |
| `is_active` | `BOOLEAN` | Hidden from AI when false |
| `timeout_ms` | `INTEGER` | default `8000`; clamped 1000–30000 at the handler layer |
| `created_at` / `updated_at` | `TIMESTAMPTZ` | `NOW()` |

**Unique:** `(client_id, name)` — one tool name per tenant, enforced at DB.  
**Indexes:** `idx_client_tools_active (client_id, is_active)` — matches the retrieval `WHERE` clause exactly.

**Webhook envelope** posted to the tenant URL:
```json
{ "clientId": 1, "customer": "628xxx", "tool": "lookup_order_status", "args": { "orderId": "ORD-1" } }
```

**Builtin registry** lives in Go (`backend/services/tools.go::builtinRegistry`); current entries:
- `lookup_memory` — returns CustomerMemory record for this customer (safe, read-only).

---

### 11. `system_diagnoses` — Health check log

| Column | Type | Notes |
|--------|------|-------|
| `id` | `BIGSERIAL` | PK |
| `service_name` | `TEXT` | `PostgreSQL`, `Redis`, `Evolution API`, etc. |
| `status` | `TEXT` | `healthy` / `degraded` / `unhealthy` |
| `latency` | `INTEGER` | ms |
| `last_check` | `TIMESTAMPTZ` | `NOW()` |

---

## Common Queries

```sql
-- List users
SELECT id, email, role, created_at FROM users ORDER BY id;

-- Reset SUPER_ADMIN password (generate bcrypt hash separately)
UPDATE users
SET password = '$2a$10$<new-hash>'
WHERE email = 'admin@mantra.ai';

-- Tenant activity snapshot
SELECT c.name,
       c.token_balance,
       COUNT(wi.id)              AS wa_instances,
       COUNT(im.id) FILTER (WHERE im.timestamp > NOW() - INTERVAL '1 day') AS msgs_24h
FROM   clients c
LEFT   JOIN whatsapp_instances wi ON wi.client_id = c.id
LEFT   JOIN inbox_messages    im ON im.client_id = c.id
GROUP  BY c.id
ORDER  BY c.name;

-- Purge expired customer memories (cron daily)
DELETE FROM customer_memories WHERE expires_at < NOW();

-- AI provider fallback order for a tenant
SELECT provider_name, priority, is_active, last_error
FROM   ai_providers
WHERE  client_id IS NULL OR client_id = :tenant_id
ORDER  BY priority;
```

---

## Migration & Backup

```bash
# Backup
docker compose exec postgres pg_dump -U mantra mantra_db > backup_$(date +%F).sql

# Restore
docker compose exec -T postgres psql -U mantra mantra_db < backup_YYYY-MM-DD.sql

# Re-apply DDL (idempotent)
docker compose exec -T postgres psql -U mantra mantra_db < backend/database/init.sql
```

---

## Changelog

- **v1.2 (current)** — Phase 4: added `client_tools` (AI function-calling
  registry). Total tables = 11.
- **v1.1** — Phase 2: added `client_knowledge_chunks` (pgvector) +
  `client_faqs` for RAG. Introduced `pgvector` extension requirement;
  image changed to `pgvector/pgvector:pg15`.
- **v1.0** — 8-table MVP schema; WhatsApp provider abstraction via
  `provider_type` + `provider_config` JSONB for future multi-provider
  support.
