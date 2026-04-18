-- =============================================================
-- Mantra AI — Full Database DDL
-- Source: docs/schema.ts
-- Run this once on a fresh PostgreSQL 15+ database.
-- =============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- pgvector is used for semantic search / RAG over per-tenant knowledge base.
-- Required image: pgvector/pgvector:pg15 (set in docker-compose.yaml).
CREATE EXTENSION IF NOT EXISTS "vector";

-- Enums
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'CLIENT_ADMIN', 'STAFF');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE instance_status AS ENUM ('CONNECTED', 'CONNECTING', 'DISCONNECTED', 'ERROR');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE whatsapp_provider_type AS ENUM ('WHATSAPP_WEB_JS');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------
-- 1. USERS & AUTH
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id          BIGSERIAL PRIMARY KEY,
    email       TEXT        NOT NULL UNIQUE,
    password    TEXT        NOT NULL,
    role        user_role   NOT NULL DEFAULT 'CLIENT_ADMIN',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- ---------------------------------------------------------------
-- 2. CLIENTS (TENANTS)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
    id            BIGSERIAL PRIMARY KEY,
    name          TEXT    NOT NULL,
    token_balance INTEGER NOT NULL DEFAULT 0,
    token_limit   INTEGER NOT NULL DEFAULT 1000,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- 3. AI PROVIDERS & FALLBACK CREDENTIALS
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_providers (
    id            BIGSERIAL PRIMARY KEY,
    client_id     BIGINT  REFERENCES clients(id) ON DELETE SET NULL,
    provider_name TEXT    NOT NULL,
    api_key       TEXT    NOT NULL,
    base_url      TEXT,
    priority      INTEGER NOT NULL DEFAULT 1,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    last_error    TEXT,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_providers_client_id ON ai_providers (client_id);
CREATE INDEX IF NOT EXISTS idx_ai_providers_priority  ON ai_providers (priority);

-- ---------------------------------------------------------------
-- 4. CLIENT AI CONFIGURATION (PERSONA & KNOWLEDGE)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS client_ai_configs (
    id               BIGSERIAL PRIMARY KEY,
    client_id        BIGINT UNIQUE NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    model_id         TEXT        NOT NULL,
    system_prompt    TEXT        NOT NULL,
    vector_namespace TEXT,
    temperature      NUMERIC(3,2) NOT NULL DEFAULT 0.70,
    memory_ttl_days  INTEGER      NOT NULL DEFAULT 4,
    CONSTRAINT temperature_range CHECK (temperature >= 0 AND temperature <= 2),
    CONSTRAINT memory_ttl_range  CHECK (memory_ttl_days >= 1 AND memory_ttl_days <= 4)
);

-- ---------------------------------------------------------------
-- 5. WHATSAPP INSTANCES (MULTI-PROVIDER GATEWAY)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whatsapp_instances (
    id               BIGSERIAL PRIMARY KEY,
    client_id        BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    instance_name    TEXT   NOT NULL UNIQUE,
    instance_api_key TEXT,
    webhook_url      TEXT,
    provider_type    whatsapp_provider_type NOT NULL DEFAULT 'WHATSAPP_WEB_JS',
    provider_config  JSONB NOT NULL DEFAULT '{}'::jsonb,
    status           instance_status NOT NULL DEFAULT 'DISCONNECTED',
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_client_id     ON whatsapp_instances (client_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_instance_name ON whatsapp_instances (instance_name);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_provider_type ON whatsapp_instances (provider_type);

-- ---------------------------------------------------------------
-- 6. TRANSIENT CUSTOMER MEMORY (4-DAY TTL)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_memories (
    id              BIGSERIAL PRIMARY KEY,
    client_id       BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    customer_number TEXT   NOT NULL,
    summary         TEXT,
    raw_history     JSONB,
    expires_at      TIMESTAMPTZ NOT NULL,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (client_id, customer_number)
);

CREATE INDEX IF NOT EXISTS idx_customer_memories_client_number ON customer_memories (client_id, customer_number);
CREATE INDEX IF NOT EXISTS idx_customer_memories_expires_at    ON customer_memories (expires_at);

-- ---------------------------------------------------------------
-- 7. INBOX MESSAGES
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inbox_messages (
    id                TEXT PRIMARY KEY,
    client_id         BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    customer_number   TEXT   NOT NULL,
    message           TEXT   NOT NULL,
    direction         TEXT   NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    timestamp         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ai_thought_process TEXT,
    model_used         TEXT
);

CREATE INDEX IF NOT EXISTS idx_inbox_messages_client_id  ON inbox_messages (client_id);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_timestamp  ON inbox_messages (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_inbox_messages_direction  ON inbox_messages (direction);

-- ---------------------------------------------------------------
-- 8. KNOWLEDGE BASE — PER-TENANT DOCUMENTS / CHUNKS (RAG)
-- ---------------------------------------------------------------
-- Vector dim 1536 matches OpenAI text-embedding-3-small (most common).
-- If you swap to text-embedding-3-large (3072) or BGE-small (384), update
-- the column and re-embed existing rows.
CREATE TABLE IF NOT EXISTS client_knowledge_chunks (
    id          BIGSERIAL PRIMARY KEY,
    client_id   BIGINT      NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    content     TEXT        NOT NULL,
    embedding   vector(1536),
    source      TEXT,                       -- e.g. 'FAQ', 'product-catalog.pdf', 'manual-paste'
    category    TEXT,                       -- e.g. 'return-policy', 'shipping', 'pricing'
    metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,
    token_count INTEGER,                    -- approx tokens in content (for budgeting)
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- B-tree on client_id: fast tenant scoping (every query is client-scoped)
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_client_id
    ON client_knowledge_chunks (client_id);

-- HNSW index for fast approximate nearest-neighbor on the embedding.
-- Built lazily; on a fresh table this is essentially free.
-- Uses cosine distance (vector_cosine_ops) which matches how OpenAI
-- embeddings are typically compared.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'client_knowledge_chunks'
          AND indexname = 'idx_knowledge_chunks_embedding_hnsw'
    ) THEN
        EXECUTE 'CREATE INDEX idx_knowledge_chunks_embedding_hnsw
                 ON client_knowledge_chunks
                 USING hnsw (embedding vector_cosine_ops)';
    END IF;
EXCEPTION
    WHEN undefined_object THEN
        -- pgvector not installed (unusual, but fail gracefully)
        RAISE NOTICE '[Mantra] pgvector extension missing — HNSW index skipped.';
END $$;

-- ---------------------------------------------------------------
-- 9. STRUCTURED FAQ PER-TENANT
-- ---------------------------------------------------------------
-- FAQs are human-authored, editable, and MATCHED FIRST (before vector
-- retrieval) because exact-match Q&A is higher quality than semantic
-- similarity for well-known questions.
-- Tags and trigger_keywords use JSONB arrays rather than TEXT[] because
-- GORM has native serializer:json support without extra dependencies.
-- Query with: WHERE tags @> '"shipping"' OR tags ? 'shipping'
CREATE TABLE IF NOT EXISTS client_faqs (
    id                BIGSERIAL PRIMARY KEY,
    client_id         BIGINT  NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    question          TEXT    NOT NULL,
    answer            TEXT    NOT NULL,
    tags              JSONB   NOT NULL DEFAULT '[]'::jsonb,
    priority          INTEGER NOT NULL DEFAULT 0,    -- higher = shown first
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    trigger_keywords  JSONB   NOT NULL DEFAULT '[]'::jsonb, -- exact/fuzzy keyword match
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_faqs_client_id       ON client_faqs (client_id);
CREATE INDEX IF NOT EXISTS idx_faqs_active_priority ON client_faqs (client_id, is_active, priority DESC);
-- GIN index lets us query arrays fast: WHERE tags @> '"shipping"'::jsonb
CREATE INDEX IF NOT EXISTS idx_faqs_tags_gin        ON client_faqs USING gin (tags jsonb_path_ops);

-- ---------------------------------------------------------------
-- 10. CLIENT TOOLS (Phase 4 — AI function calling)
-- ---------------------------------------------------------------
-- Per-tenant tool definitions the AI can invoke during a conversation.
-- Supported handler types:
--   builtin  — Go-side handler looked up by `handler_config->>'name'`
--              (e.g. "lookup_memory"). Safe, preinstalled.
--   webhook  — POST to `handler_config->>'url'` with
--              {"customer": "...", "args": {...}, "clientId": N}.
--              The response body (up to 8 KiB) becomes the tool result.
--
-- parameters_schema follows JSON Schema (OpenAI function-calling format).
-- Example:
--   {
--     "type":"object",
--     "properties":{"orderId":{"type":"string"}},
--     "required":["orderId"]
--   }
CREATE TABLE IF NOT EXISTS client_tools (
    id                BIGSERIAL PRIMARY KEY,
    client_id         BIGINT  NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name              TEXT    NOT NULL,                    -- snake_case, unique per client
    description       TEXT    NOT NULL,                    -- LLM sees this to decide when to call
    parameters_schema JSONB   NOT NULL DEFAULT '{}'::jsonb,-- JSON Schema object
    handler_type      TEXT    NOT NULL DEFAULT 'webhook',  -- 'builtin' | 'webhook'
    handler_config    JSONB   NOT NULL DEFAULT '{}'::jsonb,-- { name:string } OR { url, secret? }
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    timeout_ms        INTEGER NOT NULL DEFAULT 8000,       -- per-call timeout (1-30s)
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (client_id, name)
);

CREATE INDEX IF NOT EXISTS idx_client_tools_active ON client_tools (client_id, is_active);

-- ---------------------------------------------------------------
-- 11. SYSTEM DIAGNOSIS
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS system_diagnoses (
    id           BIGSERIAL PRIMARY KEY,
    service_name TEXT    NOT NULL,
    status       TEXT,
    latency      INTEGER,
    last_check   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------
-- ---------------------------------------------------------------
-- Seed: default accounts (DEVELOPMENT ONLY — DO NOT USE IN PRODUCTION)
-- ---------------------------------------------------------------
-- ⚠️  SECURITY WARNING: These are bcrypt hashes for default passwords.
--     For production, either:
--     1. Remove this seed data and create users via the API
--     2. Replace with environment-variable-driven seeding
--     3. Generate new hashes with strong, unique passwords
--
-- Default credentials (FOR DEV ONLY):
--   SUPER_ADMIN  → admin@mantra.ai    / MantraAdmin2024!  (CHANGE THIS!)
--   CLIENT_ADMIN → demo@mantra.ai     / admin123          (CHANGE THIS!)
--
-- To generate new bcrypt hash: https://bcrypt.online or use Node.js bcrypt
-- ---------------------------------------------------------------

-- Bootstrap default users ONLY if users table is completely empty.
-- Safe to run on fresh or existing databases — idempotent.
-- After first login, CHANGE THE PASSWORD via UI/API or by direct UPDATE.
DO $$
DECLARE
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;

    IF user_count = 0 THEN
        INSERT INTO users (email, password, role) VALUES
            ('admin@mantra.ai', '$2a$10$GNm/LleSefP5IS3.mbmNWuiHGOZGKTnDdEKrtdu/KBoZk.VO0XIby', 'SUPER_ADMIN'),
            ('demo@mantra.ai',  '$2a$10$Id0AHtQpCETR7PChpQS08eQOjd65/zxuYeDEfy6If7Dc2tzZ1teuO', 'CLIENT_ADMIN');

        RAISE NOTICE '[Mantra] Bootstrapped default users. CHANGE PASSWORDS immediately after first login!';
        RAISE NOTICE '[Mantra]   admin@mantra.ai / MantraAdmin2024!  (SUPER_ADMIN)';
        RAISE NOTICE '[Mantra]   demo@mantra.ai  / admin123           (CLIENT_ADMIN)';
    ELSE
        RAISE NOTICE '[Mantra] Users table already populated (% rows) — skipping bootstrap.', user_count;
    END IF;
END $$;
