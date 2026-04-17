-- =============================================================
-- Mantra AI — Full Database DDL
-- Source: docs/schema.ts
-- Run this once on a fresh PostgreSQL 15+ database.
-- =============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
-- 8. SYSTEM DIAGNOSIS
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

-- Check if seeding is enabled via environment (for safety)
-- In production, set SEED_DEFAULT_USERS=false in your environment
DO $$
BEGIN
    -- Only seed if explicitly enabled or in development
    -- This check prevents accidental seeding in production
    IF current_setting('app.seed_users', true) = 'true' 
       OR current_setting('app.environment', true) = 'development' THEN
        
        INSERT INTO users (email, password, role) VALUES
            ('admin@mantra.ai', '$2a$10$GNm/LleSefP5IS3.mbmNWuiHGOZGKTnDdEKrtdu/KBoZk.VO0XIby', 'SUPER_ADMIN'),
            ('demo@mantra.ai',  '$2a$10$Id0AHtQpCETR7PChpQS08eQOjd65/zxuYeDEfy6If7Dc2tzZ1teuO', 'CLIENT_ADMIN')
        ON CONFLICT (email) DO UPDATE
            SET password = EXCLUDED.password,
                role     = EXCLUDED.role;
                
        RAISE NOTICE 'Default users seeded (DEVELOPMENT ONLY)';
    ELSE
        RAISE NOTICE 'Skipping default user seeding (production mode)';
    END IF;
END $$;
