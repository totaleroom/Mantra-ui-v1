import { pgTable, serial, text, timestamp, integer, boolean, jsonb, pgEnum, decimal } from "drizzle-orm/pg-core";

// ENUMS
export const userRoleEnum = pgEnum("user_role", ["SUPER_ADMIN", "CLIENT_ADMIN", "STAFF"]);
export const instanceStatusEnum = pgEnum("instance_status", ["CONNECTED", "CONNECTING", "DISCONNECTED", "ERROR"]);

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

// 5. WHATSAPP INSTANCES (EVOLUTION API BRIDGE)
export const whatsappInstances = pgTable("whatsapp_instances", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").references(() => clients.id),
  instanceName: text("instance_name").unique().notNull(),
  instanceApiKey: text("instance_api_key"),
  webhookUrl: text("webhook_url"),
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
