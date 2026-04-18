import { pgTable, serial, text, timestamp, integer, boolean, jsonb, pgEnum, decimal } from "drizzle-orm/pg-core";

// ENUMS
export const userRoleEnum = pgEnum("user_role", ["SUPER_ADMIN", "CLIENT_ADMIN", "STAFF"]);
export const instanceStatusEnum = pgEnum("instance_status", ["CONNECTED", "CONNECTING", "DISCONNECTED", "ERROR"]);
export const whatsappProviderTypeEnum = pgEnum("whatsapp_provider_type", ["WHATSAPP_WEB_JS"]);

// 1. USERS & AUTH
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: userRoleEnum("role").default("CLIENT_ADMIN"),
  createdAt: timestamp("created_at").defaultNow(),
});

// 2. CLIENTS (TENANTS) & BILLING
export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  tokenBalance: integer("token_balance").default(0),
  tokenLimit: integer("token_limit").default(1000),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// 3. MULTI-AI PROVIDERS & FALLBACK CREDENTIALS
export const aiProviders = pgTable("ai_providers", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id), // Null if global admin
  providerName: text("provider_name").notNull(), // e.g., 'OpenRouter', 'Groq', 'OpenAI'
  apiKey: text("api_key").notNull(),
  baseUrl: text("base_url"),
  priority: integer("priority").default(1), // Low number = High Priority
  isActive: boolean("is_active").default(true),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 4. CLIENT AI CONFIGURATION (PERSONA & KNOWLEDGE)
export const clientAiConfigs = pgTable("client_ai_configs", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id).unique(),
  modelId: text("model_id").notNull(), // Dynamic model string
  systemPrompt: text("system_prompt").notNull(),
  vectorNamespace: text("vector_namespace"), // RAG Isolation
  temperature: decimal("temperature", { precision: 2, scale: 1 }).default("0.7"),
  memoryTtlDays: integer("memory_ttl_days").default(4),
});

// 5. WHATSAPP INSTANCES (MULTI-PROVIDER GATEWAY)
export const whatsappInstances = pgTable("whatsapp_instances", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  instanceName: text("instance_name").unique().notNull(),
  instanceApiKey: text("instance_api_key"),
  webhookUrl: text("webhook_url"),
  providerType: whatsappProviderTypeEnum("provider_type").default("WHATSAPP_WEB_JS").notNull(),
  providerConfig: jsonb("provider_config").default({}),
  status: instanceStatusEnum("status").default("DISCONNECTED"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 6. TRANSIENT CUSTOMER MEMORY (4-DAY TTL)
export const customerMemories = pgTable("customer_memories", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  customerNumber: text("customer_number").notNull(),
  summary: text("summary"), // Context compression
  rawHistory: jsonb("raw_history"), // Last 5-10 messages
  expiresAt: timestamp("expires_at").notNull(), // Managed by Go Worker (TTL 4 Days)
  updatedAt: timestamp("updated_at").defaultNow(),
});

// 7. SYSTEM DIAGNOSIS
export const systemDiagnosis = pgTable("system_diagnosis", {
  id: serial("id").primaryKey(),
  serviceName: text("service_name").notNull(), // 'EvolutionAPI', 'Postgres', 'Redis'
  status: text("status"),
  latency: integer("latency"), // in ms
  lastCheck: timestamp("last_check").defaultNow(),
});

// 8. CLIENT KNOWLEDGE CHUNKS (Phase 2 — RAG)
// NOTE: embedding is a pgvector(1536) column; Drizzle doesn't have a
// first-class helper for it. Declared as jsonb here for TS typing only;
// the actual DDL in backend/database/init.sql uses `vector(1536)`.
// Swap to the pgvector Drizzle adapter if/when added to the project.
export const clientKnowledgeChunks = pgTable("client_knowledge_chunks", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  embedding: jsonb("embedding"), // pgvector(1536) in DDL
  source: text("source"),        // e.g. 'manual-paste', 'product-catalog.pdf'
  category: text("category"),    // e.g. 'shipping', 'pricing'
  metadata: jsonb("metadata").default({}).notNull(),
  tokenCount: integer("token_count"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 9. CLIENT FAQS (Phase 2)
export const clientFaqs = pgTable("client_faqs", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  tags: jsonb("tags").default([]).notNull(),                      // string[]
  priority: integer("priority").default(0).notNull(),              // higher = shown first
  isActive: boolean("is_active").default(true).notNull(),
  triggerKeywords: jsonb("trigger_keywords").default([]).notNull(),// string[]
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 10. CLIENT TOOLS (Phase 4 — AI function calling)
// handler_type: 'builtin' (Go func via handlerConfig.name) or 'webhook'
// (POST to handlerConfig.url with optional X-Mantra-Secret). See
// backend/services/tools.go and docs/api-contract.md § Client Tools.
export const clientTools = pgTable("client_tools", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  name: text("name").notNull(),                        // snake_case, UNIQUE (client_id, name)
  description: text("description").notNull(),          // LLM reads this
  parametersSchema: jsonb("parameters_schema").default({}).notNull(), // JSON Schema
  handlerType: text("handler_type").default("webhook").notNull(),     // 'builtin' | 'webhook'
  handlerConfig: jsonb("handler_config").default({}).notNull(),       // {name} | {url, secret?}
  isActive: boolean("is_active").default(true).notNull(),
  timeoutMs: integer("timeout_ms").default(8000).notNull(),           // 1000–30000
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
