# 11 — Phase 2-4 Deploy & Smoke Test

> Purpose: verify Knowledge Base, RAG, and Tool Calling work end-to-end on
> the live VPS before building Phase 5. One-shot runbook; do not skip
> steps.

---

## 0. Pre-flight (local machine)

```powershell
# Frontend type-check must be clean
npx tsc --noEmit
# Expect: exit 0
```

Backend Go compile cannot be verified locally unless Docker Desktop is
running. Coolify build will surface any Go compile errors — watch the
build log on the first deploy and roll back if it fails.

---

## 1. Commit & push

From whatever git client you use (GitHub Desktop / CLI via WSL / etc.):

```bash
git add -A
git commit -m "feat(ai): Phase 2-4 — Knowledge Base + RAG + Tool Calling

- Knowledge Base: pgvector schema, embedding service (OpenAI-compat),
  CRUD API, chunks ingestion, FAQ UI, Apple x Nothing dashboard.
- RAG: per-tenant retrieval service (FAQ keyword + vector ANN),
  wired into orchestrator.buildConversation, audit logged to
  inbox_messages.ai_thought_process.
- Tool Calling: client_tools table, AIFallbackService.ChatWithTools,
  ToolService (builtin lookup_memory + webhook handler with SSRF
  mitigation), orchestrator.runReplyLoop (max 3 iterations),
  CRUD API + tools management page.
- Fixed Phase 3 comment corruption in orchestrator HandleInbound."
git push origin main
```

Coolify will auto-rebuild on push. Watch the build log in the Coolify
dashboard. If backend build fails, the old container keeps serving —
no downtime, safe to iterate.

---

## 2. Post-deploy — pgvector extension + schema

SSH into the VPS:

```bash
ssh root@YOUR_VPS_IP
docker ps --format "table {{.Names}}\t{{.Status}}"
# Expect: all mantra containers "Up"
```

Verify Postgres image is pgvector:

```bash
docker compose -f /data/coolify/applications/mantra/docker-compose.yaml config \
  | grep "image:" | grep postgres
# Expect: image: pgvector/pgvector:pg15
```

If the old `postgres:15-alpine` image is still running, Coolify may
need a manual service redeploy. Go to Coolify UI → Postgres service →
Redeploy. Data volume survives — it's the same PGDATA format.

Verify extension + tables:

```bash
docker compose exec -T postgres psql -U mantra -d mantra_db <<'SQL'
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';
-- Expect: vector | 0.x.x

\dt client_knowledge_chunks
\dt client_faqs
\dt client_tools
-- All three should list. If not, init.sql didn't run.

\d client_knowledge_chunks
-- Expect: embedding column of type vector(1536).
SQL
```

If any table is missing:

```bash
docker compose exec postgres psql -U mantra -d mantra_db \
  -f /docker-entrypoint-initdb.d/init.sql
```

---

## 3. Smoke test — Knowledge Base

### 3a. Upload a chunk via UI

1. Log in at `https://mantra.yourdomain.com` (demo@mantra.ai / admin123
   — change immediately after).
2. Navigate to `Tenants` → click any tenant → click "Knowledge Base"
   button in the header.
3. Paste a sample text (≥ 20 chars) into the Documents tab textarea.
   Example:
   ```
   Pengiriman ke Jakarta, Bogor, Depok, Tangerang, Bekasi:
   Ongkir Rp 20.000, estimasi 1-2 hari kerja.
   Pengiriman ke luar Jabodetabek: JNE REG, YES, OKE tersedia.
   ```
4. Click "Upload & Embed".

**Expected**: green "Embedded N chunks via <provider>" message appears
below the form. Chunk appears in "Indexed chunks" list below.

**If it fails with "embedding provider failed"**: the client has no
OpenAI-compat provider with `provider_name != 'groq'`. Add one via
`/ai-providers` UI (OpenAI, OpenRouter, or any compatible endpoint).

### 3b. Verify DB persistence

```bash
docker compose exec -T postgres psql -U mantra -d mantra_db <<'SQL'
SELECT id, client_id, length(content) AS content_len,
       (embedding IS NOT NULL) AS has_embedding,
       source, category
FROM client_knowledge_chunks
ORDER BY id DESC LIMIT 5;
SQL
```

`has_embedding = t` on the new row confirms the vector made it into
pgvector storage.

### 3c. Create an FAQ

1. In the Knowledge Base page → switch to "FAQ" tab → click "New FAQ".
2. Fill in:
   - Question: `Berapa ongkir ke Bandung?`
   - Answer: `Ongkir JNE REG ke Bandung Rp 15.000, estimasi 2-3 hari.`
   - Trigger keywords: `ongkir, shipping, bandung`
   - Tags: `shipping, bandung`
   - Priority: `5`
3. Save.

**Expected**: FAQ row appears with all fields. Tags visible as pills.

---

## 4. Smoke test — RAG in orchestrator

### 4a. Trigger an inbound with a matching query

Send a WhatsApp message to the tenant's connected number:

> "Berapa ongkir ke bandung ya kak?"

### 4b. Verify RAG context was retrieved

```bash
docker compose logs backend --tail=100 | grep "Orchestrator"
```

**Expected log sequence**:
```
[Orchestrator] persisting inbound for client N
[Orchestrator] no error / successful AI call
```

Check the outbound message's audit blob:

```bash
docker compose exec -T postgres psql -U mantra -d mantra_db <<'SQL'
SELECT id, direction, ai_thought_process
FROM inbox_messages
WHERE direction = 'outbound'
ORDER BY timestamp DESC
LIMIT 1;
SQL
```

**Expected**: `ai_thought_process` contains JSON like:
```json
{
  "retrievedFaqs": [1],
  "retrievedChunks": [1, 2],
  "embedProvider": "openai"
}
```

At least one of `retrievedFaqs` OR `retrievedChunks` should be
non-empty, proving retrieval was applied.

### 4c. Verify AI used the retrieved info

The outbound reply the customer receives should reference Rp 15.000
(from the FAQ) or the JNE options (from the chunk). If the reply is
generic or wrong, retrieval landed but the model ignored it — usually
solved by tightening the system prompt to say "prefer the knowledge
base over your general knowledge".

---

## 5. Smoke test — Tool Calling

### 5a. Create a webhook tool

Prepare a simple tenant-side echo endpoint (webhook.site or a tiny
Node script works):

```js
// For quick testing: https://webhook.site gives you a URL + log
```

Or a real Express stub:

```js
import express from 'express'
const app = express()
app.use(express.json())
app.post('/mantra/order', (req, res) => {
  console.log('Mantra called us:', req.body)
  res.json({
    orderId: req.body.args.orderId,
    status: 'SHIPPED',
    eta: '2026-04-21',
    courier: 'JNE REG'
  })
})
app.listen(3333)
```

In the UI, navigate to the tenant → "Tools" button → "New Tool":

- Name: `lookup_order_status`
- Handler type: `Webhook (your URL)`
- Webhook URL: `https://your-webhook-url/mantra/order`
- Description: `Check current status of a customer's order. Call when
  the customer asks about their order, shipment, or delivery.`
- Parameters schema:
  ```json
  {
    "type": "object",
    "properties": {
      "orderId": {
        "type": "string",
        "description": "Order ID e.g. ORD-12345"
      }
    },
    "required": ["orderId"]
  }
  ```
- Timeout: `5000`
- Active: checked

Save. Tool appears in the list with the webhook pill.

### 5b. Trigger a tool call via WhatsApp

Send from the test customer:

> "Kak, pesanan ORD-12345 sudah dikirim belum?"

### 5c. Verify the tool was called

On your webhook receiver (webhook.site log or Express stdout), you
should see a POST with body:

```json
{
  "clientId": 1,
  "customer": "628xxxxxxx",
  "tool": "lookup_order_status",
  "args": {"orderId": "ORD-12345"}
}
```

The customer should receive a reply mentioning "SHIPPED" and
"2026-04-21" (info from the webhook response).

### 5d. Verify the audit trail

```bash
docker compose exec -T postgres psql -U mantra -d mantra_db <<'SQL'
SELECT ai_thought_process
FROM inbox_messages
WHERE direction = 'outbound'
ORDER BY timestamp DESC LIMIT 1;
SQL
```

**Expected** — `toolCalls` array populated:
```json
{
  "retrievedFaqs": [],
  "retrievedChunks": [],
  "embedProvider": "openai",
  "toolCalls": [{
    "name": "lookup_order_status",
    "callId": "call_abc...",
    "args": "{\"orderId\":\"ORD-12345\"}",
    "result": "{\"orderId\":\"ORD-12345\",\"status\":\"SHIPPED\",...}",
    "durationMs": 123
  }]
}
```

---

## 6. Smoke test — Builtin tool (lookup_memory)

Create a second tool:

- Name: `check_last_conversation`
- Handler type: `Builtin (Go handler)`
- Builtin handler: `lookup_memory`
- Description: `Look up what this customer previously chatted about
  with us.`
- Parameters schema: `{"type":"object","properties":{}}`

From the same customer number that has prior conversation history:

> "Terakhir kemarin kita ngobrol soal apa ya?"

Expected: reply references the last-seen timestamp and turn count.
Audit trail should show the builtin was called with empty args.

---

## 7. Failure modes to watch for

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Tool upload button disabled | Name not snake_case or description empty | Check form validation hints |
| "embedding provider failed" | Only Groq configured (no embeddings) | Add OpenAI/OpenRouter provider |
| `ai_thought_process IS NULL` | Orchestrator didn't run or RAG/tools disabled | Check backend logs for `[Orchestrator]` lines |
| Webhook returns 404 all the time | URL typo or endpoint not listening | Curl the URL manually first |
| Loop exits with "exceeded N tool iterations" | LLM keeps requesting tools instead of replying | Tighten tool descriptions; model may be weak (try upgrading model) |
| Response timeout >30s | Webhook endpoint slow | Cut `timeoutMs` + optimize tenant endpoint |

---

## 8. Rollback plan

If anything is catastrophically broken in production:

1. Coolify dashboard → backend service → "Rollback" button → pick the
   previous successful deploy.
2. The DB schema is additive-only; no rollback needed on the database
   side.
3. If rows in `client_knowledge_chunks` / `client_faqs` / `client_tools`
   cause problems, truncate them safely:

```sql
TRUNCATE client_tools, client_faqs, client_knowledge_chunks;
```

This doesn't affect existing tenants, configs, or messages.

---

## 9. Sign-off checklist

Before declaring Phase 2-4 production-ready:

- [ ] `\dt` shows all three new tables in Postgres
- [ ] pgvector extension version prints
- [ ] Chunk upload succeeds AND produces `has_embedding = t`
- [ ] FAQ create/edit/delete round-trip works in UI
- [ ] Inbound WA triggers outbound with `ai_thought_process` populated
- [ ] `retrievedFaqs` OR `retrievedChunks` is non-empty when keyword
      matches
- [ ] Webhook tool triggers an HTTP POST to the configured URL
- [ ] `toolCalls` entry appears in `ai_thought_process` after a tool
      round-trip
- [ ] Builtin `lookup_memory` returns prior turn info
- [ ] No ERROR-level lines in backend logs for a 10-minute window

Once all boxes tick, Phase 2-4 is live. Proceed to Phase 5 (tiered
model routing) or Phase 6 (production hardening) per the roadmap.
