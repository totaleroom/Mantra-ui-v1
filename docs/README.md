# Mantra AI — docs/

Technical reference material. For high-level flows see the root-level guides.

| File | What it covers |
|------|----------------|
| [`api-contract.md`](./api-contract.md) | All REST endpoints + WebSocket events with request/response shapes, validation rules, status codes |
| [`database-schema.md`](./database-schema.md) | 8 tables, enums, indexes, common queries, backup/restore |
| [`schema.ts`](./schema.ts) | Drizzle-ORM mirror of the Postgres schema (for TS typing) |
| [`PRD.md`](./PRD.md) | Product requirements, feature matrix, MoSCoW priorities |

---

## Where to find things outside this folder

| Need | File |
|------|------|
| Project overview & quick start | [`../README.md`](../README.md) |
| How the system is put together | [`../ARCHITECTURE.md`](../ARCHITECTURE.md) |
| Local development workflow | [`../DEVELOPMENT.md`](../DEVELOPMENT.md) |
| Production deployment (VPS + Coolify) | [`../DEPLOY_COOLIFY.md`](../DEPLOY_COOLIFY.md) |
| Autonomous agent operational brief | [`../AI_AGENT_BRIEF.md`](../AI_AGENT_BRIEF.md) |
| Environment variable template | [`../.env.example`](../.env.example) |
| Database DDL (source of truth) | [`../backend/database/init.sql`](../backend/database/init.sql) |
| Live credentials (gitignored) | `../CREDENTIALS.md` |

---

## Maintenance rules

- Schema change → update `backend/database/init.sql` **and** `docs/database-schema.md` **and** `docs/schema.ts`.
- New endpoint → update `docs/api-contract.md`.
- New env var → update `.env.example`, `lib/env.ts`, `lib/config.ts`, `backend/config/config.go`.
- Architectural change → update `ARCHITECTURE.md`.
