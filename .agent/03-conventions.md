# 03 — Conventions & Invariants

## Language & style

### Go backend
- Go **1.25**, Fiber v2, GORM v2.
- Package per directory, no circular imports.
- Logs: `log.Printf("[Component] message: %v", err)` — prefix makes grep easy.
- Errors: return wrapped (`fmt.Errorf("context: %w", err)`), never swallow.
- Never panic except in `main.go` init. Use `if err != nil { return }`.
- No ORM hooks for business logic. Do it explicitly in handlers/services.

### TypeScript frontend
- Strict mode on (`tsconfig.json`). No `any` without a comment explaining.
- React Server Components by default; `'use client'` only when needed.
- Data fetching:
  - **Server components** → direct `fetch` with `cache: 'no-store'`.
  - **Client components** → React Query via `hooks/use-*.ts`.
- State: local `useState` → lifted context → Zustand only if truly global.
  We have *zero* Zustand stores right now; keep it that way unless forced.
- Tailwind + shadcn/ui. Don't add a new UI library.

## Naming

| Thing | Pattern | Example |
|-------|---------|---------|
| Go package | lowercase, single word | `handlers`, `services` |
| Go exported | PascalCase | `SendWhatsAppMessage` |
| Go file | snake_case | `ai_fallback.go` |
| TS component | PascalCase, one per file | `ReplyComposer` |
| TS hook | `use-*` kebab file, `useX` export | `use-whatsapp.ts` → `useWhatsapp` |
| Route path | kebab | `/api/whatsapp/instances` |
| DB table | snake_case plural | `inbox_messages` |
| Env var | SCREAMING_SNAKE | `WEBHOOK_SECRET` |

## Env var discipline

- **Server-only** vars: no `NEXT_PUBLIC_` prefix. Access via `serverConfig`
  (frontend) or `config.Load()` (backend). Never read `process.env` directly
  in app code.
- **Browser-visible** vars: `NEXT_PUBLIC_` prefix. Access via `clientConfig`.
- Every new var must be added in **three places**:
  1. `backend/config/config.go` (if backend uses it) or `lib/env.ts` (if frontend)
  2. `.env.example` with a clear comment
  3. `docker-compose.yaml` — passed through to the right container

## Security invariants (never violate)

1. **Webhook handler** validates `X-Webhook-Secret` with **constant-time compare**.
   Use `crypto/subtle.ConstantTimeCompare`, not `==`.
2. **Cookie maxAge == JWT exp**. Both 28800 s. Mismatch = ghost sessions.
3. **JWT_SECRET** min 16 chars, never the example value. Zod + Go both enforce.
4. **bcrypt cost 12** for passwords. Don't lower for speed.
5. **CSP strict in prod** (`next.config.mjs`). Dev relaxes for Turbopack.
6. **Rate limit** webhook and auth endpoints. See `routes/routes.go`.
7. **Idempotency** on inbound: check by `provider_msg_id` before persist.
8. **Token budget gate** before AI call. Inactive clients silently skipped.
9. **Secrets never in logs.** Redact any Authorization headers before logging.

## Database

- All schema changes go in `backend/database/init.sql` (idempotent with
  `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... IF NOT EXISTS`).
- GORM `AutoMigrate` runs on boot but `init.sql` is the source of truth.
- No migrations tool (no goose, no atlas). Keep it that way at MVP.
- Indexes: add for any column used in `WHERE` on hot path.

## React Query conventions

- Query keys are tuples: `['whatsapp', 'instances']`, `['inbox', 'messages', filters]`.
- `staleTime` 30 s default, override per hook.
- **All mutations must `invalidateQueries`** on success. Plus call `toast.success`.
- **All mutations must `toast.error`** on failure with a helpful message.

## WebSocket conventions

- Backend: `ws/*_ws.go`, each hub is a struct with Run/Register/Broadcast.
- Frontend: `hooks/use-inbox-live.ts` pattern — auto-reconnect with exponential
  backoff capped at 30 s.
- Message shape is always a typed JSON event: `{ type: string, data: ... }`.

## Git hygiene

- Branch names: `feat/…`, `fix/…`, `chore/…`, `docs/…`.
- Commit subject ≤ 70 chars, imperative mood.
- Never commit `.env*`, `CREDENTIALS.md`, `node_modules/`, `.next/`.
- **Before `git commit`**: run `06-verification.md` block A (type + build).

## Commenting code

**Do not add comments the user did not ask for.** Exceptions:
- Public Go functions: short godoc-style one-liner is fine.
- Security-critical constant-time blocks: a one-line "why" is fine.
- TODO markers that block production: acceptable with an issue ref.

Everywhere else: **let the code speak**. The user actively prefers no commentary.
