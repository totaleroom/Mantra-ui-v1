# Mantra AI — Database Schema Reference

> **Engine:** PostgreSQL 15+  
> **DDL source of truth:** [`backend/database/init.sql`](../backend/database/init.sql)  
> **Drizzle TS mirror:** [`docs/schema.ts`](./schema.ts)

Apply DDL on a fresh database:

```bash
psql "$DATABASE_URL" -f backend/database/init.sql
```

The DDL is **idempotent** (uses `CREATE TABLE IF NOT EXISTS`, `DO $$ ... duplicate_object`), safe to re-run.

---

## Entity Relationship Overview

```
                ┌──────────┐
                │  users   │  (auth principals — not tenant-scoped)
                └──────────┘

┌──────────┐    ┌──────────────────┐
│ clients  │◄───│ ai_providers     │  (N per client; client_id NULL = global)
│ (tenant) │    └──────────────────┘
│          │◄───│ client_ai_configs│  (1:1 — persona & knowledge per tenant)
│          │◄───│ whatsapp_instances│ (N WhatsApp connections)
│          │◄───│ customer_memories │ (TTL 4 days, customer history)
│          │◄───│ inbox_messages   │  (all chat messages)
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

### 8. `system_diagnoses` — Health check log

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

- **v1.0 (current)** — 8-table MVP schema; WhatsApp provider abstraction via `provider_type` + `provider_config` JSONB for future multi-provider support.
