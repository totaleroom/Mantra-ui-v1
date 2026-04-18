# Mantra AI - Backend API Contract

> **Version:** 1.2.0 (post-Phase-4)  
> **Base URL:** `https://your-api.example.com` (Go Fiber on VPS)  
> **Authentication:** HttpOnly cookie `mantra_session` (JWT inside). Legacy `Authorization: Bearer <token>` still accepted.  
> **Content-Type:** `application/json`

---

## Table of Contents

1. [Authentication](#authentication)
2. [AI Providers](#ai-providers)
3. [WhatsApp Instances](#whatsapp-instances)
4. [Inbox Messages](#inbox-messages)
5. [Clients (Tenants)](#clients-tenants)
6. [Knowledge Base](#knowledge-base) — Phase 2
7. [Client Tools](#client-tools) — Phase 4
8. [System Diagnosis](#system-diagnosis)
9. [WebSocket Events](#websocket-events)

---

## Authentication

All endpoints require a valid JWT token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

### Response Errors

All endpoints return errors in this format:

```json
{
  "error": "string",
  "code": "string",
  "details": {}
}
```

Common HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error)
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `500` - Internal Server Error

---

## AI Providers

### GET `/api/ai-providers`

Fetch all AI providers ordered by priority.

**Response:**
```json
[
  {
    "id": 1,
    "clientId": null,
    "providerName": "OpenRouter",
    "apiKey": "sk-or-***",
    "baseUrl": "https://openrouter.ai/api/v1",
    "priority": 1,
    "isActive": true,
    "lastError": null,
    "updatedAt": "2026-04-12T10:00:00Z"
  }
]
```

### GET `/api/ai-providers/:id`

Fetch single AI provider by ID.

**Response:** Single AIProvider object

### POST `/api/ai-providers`

Create a new AI provider.

**Request Body:**
```json
{
  "providerName": "Groq",
  "apiKey": "gsk_xxx",
  "baseUrl": "https://api.groq.com/openai/v1",
  "priority": 2,
  "isActive": true,
  "clientId": null
}
```

**Validation:**
- `providerName`: string, required, min 1 char
- `apiKey`: string, required, min 1 char
- `baseUrl`: string, valid URL or null
- `priority`: integer, 1-10
- `isActive`: boolean
- `clientId`: integer or null (null = global provider)

**Response:** Created AIProvider object

### PATCH `/api/ai-providers/:id`

Update an AI provider.

**Request Body:** Partial AIProvider fields

**Response:** Updated AIProvider object

### DELETE `/api/ai-providers/:id`

Delete an AI provider.

**Response:**
```json
{
  "success": true
}
```

### PUT `/api/ai-providers/priorities`

Bulk update provider priorities (for drag-and-drop reordering).

**Request Body:**
```json
{
  "priorities": [
    { "id": 1, "priority": 1 },
    { "id": 2, "priority": 2 },
    { "id": 3, "priority": 3 }
  ]
}
```

**Response:**
```json
{
  "success": true
}
```

### POST `/api/ai-providers/:id/test`

Test AI provider connection and measure latency.

**Response:**
```json
{
  "success": true,
  "latency": 234,
  "error": null
}
```

### GET `/api/ai-providers/models`

Fetch all available models aggregated from all active providers.

**Response:**
```json
[
  {
    "id": "gpt-4-turbo",
    "name": "GPT-4 Turbo",
    "provider": "OpenRouter",
    "contextLength": 128000,
    "pricing": {
      "input": 0.01,
      "output": 0.03
    }
  }
]
```

### GET `/api/ai-providers/:id/models`

Fetch models from a specific provider (calls provider's API).

**Response:** Array of AIModel objects

---

## WhatsApp Instances

### GET `/api/whatsapp/instances`

Fetch all WhatsApp instances.

**Response:**
```json
[
  {
    "id": 1,
    "clientId": 1,
    "instanceName": "acme-corp-main",
    "instanceApiKey": "xxx-xxx",
    "webhookUrl": "https://api.example.com/webhook/acme",
    "status": "CONNECTED",
    "updatedAt": "2026-04-12T10:00:00Z"
  }
]
```

**Status Values:** `CONNECTED` | `CONNECTING` | `DISCONNECTED` | `ERROR`

### GET `/api/whatsapp/instances/:id`

Fetch single instance by ID.

### POST `/api/whatsapp/instances`

Create a new WhatsApp instance (calls Evolution API).

**Request Body:**
```json
{
  "instanceName": "acme-corp-main",
  "clientId": 1,
  "webhookUrl": "https://api.example.com/webhook/acme"
}
```

**Validation:**
- `instanceName`: string, 3-50 chars, lowercase alphanumeric with hyphens only, regex: `^[a-z0-9-]+$`
- `clientId`: integer, required
- `webhookUrl`: string, valid URL or null

**Response:** Created WhatsAppInstance object

### DELETE `/api/whatsapp/instances/:id`

Delete a WhatsApp instance (removes from Evolution API).

**Response:**
```json
{
  "success": true
}
```

### POST `/api/whatsapp/instances/:instanceName/disconnect`

Disconnect (logout) a WhatsApp instance.

**Response:**
```json
{
  "success": true
}
```

### GET `/api/whatsapp/instances/:instanceName/status`

Fetch current connection status of an instance.

**Response:**
```json
{
  "status": "CONNECTED"
}
```

---

## Inbox Messages

### GET `/api/inbox/messages`

Fetch inbox messages with optional filters.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `clientId` | integer | Filter by client |
| `direction` | string | `inbound` or `outbound` |
| `search` | string | Search in message content |
| `limit` | integer | Max results (default: 50) |
| `offset` | integer | Pagination offset |

**Response:**
```json
[
  {
    "id": "msg_abc123",
    "clientId": 1,
    "clientName": "Acme Corp",
    "customerNumber": "+6281234567890",
    "message": "Hello, I need help with my order",
    "direction": "inbound",
    "timestamp": "2026-04-12T10:30:00Z",
    "aiThoughtProcess": "Customer is asking about order status. I should check their recent orders and provide tracking information.",
    "modelUsed": "gpt-4-turbo"
  }
]
```

### GET `/api/inbox/stats`

Fetch inbox statistics.

**Response:**
```json
{
  "total": 1250,
  "inbound": 680,
  "outbound": 570,
  "aiProcessed": 1180
}
```

---

## Clients (Tenants)

### GET `/api/clients`

Fetch all clients.

**Response:**
```json
[
  {
    "id": 1,
    "name": "Acme Corp",
    "tokenBalance": 4500,
    "tokenLimit": 10000,
    "isActive": true,
    "createdAt": "2026-01-15T08:00:00Z"
  }
]
```

### GET `/api/clients/:id`

Fetch single client.

### POST `/api/clients`

Create a new client.

**Request Body:**
```json
{
  "name": "New Corp",
  "tokenLimit": 5000,
  "isActive": true
}
```

### PATCH `/api/clients/:id`

Update a client.

**Request Body:** Partial Client fields

### DELETE `/api/clients/:id`

Delete a client.

**Response:**
```json
{
  "success": true
}
```

### GET `/api/clients/:id/ai-config`

Fetch client's AI configuration.

**Response:**
```json
{
  "id": 1,
  "clientId": 1,
  "modelId": "gpt-4-turbo",
  "systemPrompt": "You are a helpful customer service agent for {{company_name}}...",
  "vectorNamespace": "acme-knowledge",
  "temperature": 0.7,
  "memoryTtlDays": 4
}
```

### PUT `/api/clients/:id/ai-config`

Update client's AI configuration.

**Request Body:**
```json
{
  "modelId": "claude-3-opus",
  "systemPrompt": "You are a helpful assistant...",
  "vectorNamespace": "acme-knowledge",
  "temperature": 0.8,
  "memoryTtlDays": 3
}
```

**Validation:**
- `modelId`: string, required
- `systemPrompt`: string, 10-4000 chars
- `vectorNamespace`: string or null
- `temperature`: number, 0-2
- `memoryTtlDays`: integer, 1-4

---Knowledge Base

> **Phase 2.** Per-tenant RAG store. Chunks are vector-searchable via pgvector;
> FAQs are structured Q&A with tag/keyword retrieval. Both are used by
> `orchestrator.buildConversation` to enrich the system prompt. All routes
> scoped by `:id` = client ID and protected by JWT middleware.

### GET `/api/clients/:id/knowledge/stats`

Aggregate counts for the KB management UI.

**Response:**
```json
{
  "chunkCount": 124,
  "faqCount": 18,
  "lastIngestAt": "2026-04-18T12:34:00Z",
  "embeddingDim": 1536,
  "embeddingProvider": "openai"
}
```

### POST `/api/clients/:id/knowledge/chunks`

Upload raw text. The backend splits it into chunks (~500-1000 chars each),
calls the tenant's first non-Groq AI provider on its `/embeddings`
endpoint, and persists rows with the returned `vector(1536)` each.

**Request Body:**
```json
{
  "content": "Ongkir Jakarta Rp 20.000, 1-2 hari...\n\nRetur 7 hari...",
  "source": "manual-paste",
  "category": "shipping",
  "metadata": { "uploadedBy": "admin@acme.co" }
}
```

**Validation:**
- `content`: string, ≥20 chars, required
- `source` / `category`: strings, optional
- `metadata`: object, optional

**Response (201):**
```json
{
  "embedded": 3,
  "provider": "openai",
  "chunkIds": [12, 13, 14]
}
```

**Error cases:**
- `400` `content is required` / `content too short`
- `502` `embedding provider failed` — no active OpenAI-compat provider, or all failed

### GET `/api/clients/:id/knowledge/chunks`

Paginated list of stored chunks (embeddings not returned).

**Query:**
| Param | Type | Default |
|-------|------|---------|
| `limit` | integer | 50 |
| `offset` | integer | 0 |
| `category` | string | — |

**Response:**
```json
{
  "chunks": [
    {
      "id": 14,
      "clientId": 1,
      "content": "Ongkir Jakarta Rp 20.000...",
      "source": "manual-paste",
      "category": "shipping",
      "metadata": {},
      "tokenCount": 142,
      "createdAt": "2026-04-18T12:34:00Z"
    }
  ],
  "total": 124
}
```

### DELETE `/api/clients/:id/knowledge/chunks/:chunkId`

**Response:** `{ "deleted": true, "id": 14 }`

### POST `/api/clients/:id/knowledge/faqs`

Create a structured FAQ entry. FAQs are matched FIRST (before vector
retrieval) because exact Q&A beats semantic similarity on well-known
questions.

**Request Body:**
```json
{
  "question": "Berapa ongkir ke Bandung?",
  "answer": "Ongkir JNE REG ke Bandung Rp 15.000, estimasi 2-3 hari.",
  "tags": ["shipping", "bandung"],
  "triggerKeywords": ["ongkir", "shipping", "bandung"],
  "priority": 5,
  "isActive": true
}
```

**Validation:**
- `question` / `answer`: strings, required
- `tags` / `triggerKeywords`: string[], optional (stored as `JSONB`)
- `priority`: integer, default 0 (higher = shown first)
- `isActive`: boolean, default true

**Response (201):** The created FAQ object.

### GET `/api/clients/:id/knowledge/faqs`

**Response:** `{ "faqs": [ FAQ, … ] }`

### PATCH `/api/clients/:id/knowledge/faqs/:faqId`

Partial update. Same body fields as POST, all optional.

### DELETE `/api/clients/:id/knowledge/faqs/:faqId`

**Response:** `{ "deleted": true, "id": 7 }`

---

## Client Tools

> **Phase 4 — AI function calling.** Per-tenant tool registry the
> orchestrator feeds to the LLM as `[]ToolDefinition`. When the model
> returns `tool_calls`, the backend dispatches them through
> `backend/services/tools.go::Execute` and feeds results back in as
> `role: "tool"` messages. Capped at **3 iterations per inbound message**.

### GET `/api/clients/:id/tools`

**Response:**
```json
{
  "tools": [
    {
      "id": 9,
      "clientId": 1,
      "name": "lookup_order_status",
      "description": "Check current status of a customer's order.",
      "parametersSchema": {
        "type": "object",
        "properties": { "orderId": { "type": "string" } },
        "required": ["orderId"]
      },
      "handlerType": "webhook",
      "handlerConfig": {
        "url": "https://api.acme.co/mantra/orders",
        "secret": "***"
      },
      "isActive": true,
      "timeoutMs": 5000,
      "createdAt": "2026-04-18T12:34:00Z",
      "updatedAt": "2026-04-18T12:34:00Z"
    }
  ]
}
```

### POST `/api/clients/:id/tools`

**Request Body:**
```json
{
  "name": "lookup_order_status",
  "description": "Check current status of a customer's order. Call when the customer asks about shipment, delivery, or tracking.",
  "parametersSchema": {
    "type": "object",
    "properties": { "orderId": { "type": "string", "description": "Order ID like ORD-12345" } },
    "required": ["orderId"]
  },
  "handlerType": "webhook",
  "handlerConfig": {
    "url": "https://api.acme.co/mantra/orders",
    "secret": "optional-shared-secret"
  },
  "isActive": true,
  "timeoutMs": 5000
}
```

**Validation:**
- `name`: required, must match `^[a-z0-9_]+$` (snake_case, lowercase, digits, underscores)
- `description`: required (the LLM reads this to decide when to call)
- `handlerType`: `"builtin"` or `"webhook"` (default `"webhook"`)
- If `handlerType == "webhook"`: `handlerConfig.url` required, must start with `http://` or `https://`
- If `handlerType == "builtin"`: `handlerConfig.name` required, must exist in the Go-side `builtinRegistry` (current entries: `lookup_memory`)
- `timeoutMs`: integer, 1000 ≤ x ≤ 30000 (default 8000)

**Response (201):** Created tool. `409` if `(client_id, name)` already exists.

### PATCH `/api/clients/:id/tools/:toolId`

Partial update. Any subset of the POST fields.

### DELETE `/api/clients/:id/tools/:toolId`

**Response:** `{ "deleted": true, "id": 9 }`

---

### Webhook envelope (tenant-side contract)

When the AI invokes a `handlerType: "webhook"` tool, Mantra POSTs to
`handlerConfig.url`:

```http
POST /mantra/orders HTTP/1.1
Content-Type: application/json
User-Agent: Mantra-Tools/1.0
X-Mantra-Secret: <handlerConfig.secret if set>

{
  "clientId": 1,
  "customer": "6281234567890",
  "tool": "lookup_order_status",
  "args": { "orderId": "ORD-12345" }
}
```

Tenant responds with any JSON (≤ 8 KiB):

```json
{ "status": "SHIPPED", "eta": "2026-04-21", "courier": "JNE REG" }
```

The response body is fed verbatim back to the LLM as the tool result.
Non-2xx responses are wrapped as `{"error": "webhook returned N: ..."}`
so the model can see the error and try something else.

**Security:** Cross-host redirects are blocked (SSRF mitigation);
per-call timeout is clamped 1–30 s server-side.

---

## 

## System Diagnosis

### GET `/api/system/health`

Fetch health status of all services.

**Response:**
```json
{
  "services": [
    {
      "id": 1,
      "serviceName": "PostgreSQL",
      "status": "healthy",
      "latency": 12,
      "lastCheck": "2026-04-12T10:00:00Z"
    },
    {
      "id": 2,
      "serviceName": "Redis",
      "status": "healthy",
      "latency": 3,
      "lastCheck": "2026-04-12T10:00:00Z"
    },
    {
      "id": 3,
      "serviceName": "Evolution API",
      "status": "degraded",
      "latency": 450,
      "lastCheck": "2026-04-12T10:00:00Z"
    }
  ],
  "overall": "degraded"
}
```

**Status Values:** `healthy` | `degraded` | `unhealthy`

### POST `/api/system/diagnose`

Run AI-powered diagnosis and get repair recommendations.

**Response:**
```json
{
  "diagnosis": "Evolution API is experiencing high latency (450ms). This is likely due to rate limiting or network congestion.",
  "recommendations": [
    {
      "severity": "warning",
      "action": "Check Evolution API logs for rate limit errors",
      "command": "docker logs evolution-api --tail 100"
    },
    {
      "severity": "info",
      "action": "Consider implementing request queuing",
      "command": null
    }
  ]
}
```

---

## WebSocket Events

### Inbox Live Feed

**Endpoint:** `ws://your-api.example.com/api/inbox/live`

**Connection:** Requires Bearer token as query param or header.

```javascript
const ws = new WebSocket('wss://api.example.com/api/inbox/live?token=xxx')
```

**Server -> Client Events:**

#### `message` - New message received

```json
{
  "type": "message",
  "id": "msg_abc123",
  "clientId": 1,
  "clientName": "Acme Corp",
  "customerNumber": "+6281234567890",
  "message": "Hello, I need help",
  "direction": "inbound",
  "timestamp": "2026-04-12T10:30:00Z",
  "aiThoughtProcess": "Customer greeting, should respond warmly...",
  "modelUsed": "gpt-4-turbo"
}
```

#### `stats_update` - Stats changed

```json
{
  "type": "stats_update",
  "stats": {
    "total": 1251,
    "inbound": 681,
    "outbound": 570,
    "aiProcessed": 1181
  }
}
```

**Client -> Server Events:**

#### `subscribe` - Subscribe to specific client's messages

```json
{
  "type": "subscribe",
  "clientId": 1
}
```

#### `unsubscribe` - Unsubscribe from client

```json
{
  "type": "unsubscribe",
  "clientId": 1
}
```

---

### QR Code Stream

**Endpoint:** `ws://your-api.example.com/api/whatsapp/instances/:instanceName/qr`

**Server -> Client Events:**

#### `qr` - QR code image (base64)

```json
{
  "type": "qr",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

#### `connected` - Device successfully connected

```json
{
  "type": "connected",
  "phoneNumber": "+6281234567890"
}
```

#### `timeout` - QR code expired

```json
{
  "type": "timeout",
  "message": "QR code expired. Request a new one."
}
```

#### `error` - Connection error

```json
{
  "type": "error",
  "message": "Failed to generate QR code"
}
```

**Client -> Server Events:**

#### `refresh` - Request new QR code

```json
{
  "type": "refresh"
}
```

---

## Rate Limits

| Endpoint Pattern | Limit |
|-----------------|-------|
| `/api/*` (REST) | 100 req/min |
| `/api/inbox/live` (WS) | 10 connections |
| `/api/whatsapp/*/qr` (WS) | 5 connections |

---

## CORS Configuration

The backend MUST allow the following origins:

```
Access-Control-Allow-Origin: https://your-vercel-app.vercel.app
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Credentials: true
```

For WebSocket connections, ensure the `Origin` header is validated.
