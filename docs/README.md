# Mantra AI — docs/

Technical reference material. For high-level flows see the root-level guides.

| File | What it covers |
|------|----------------|
| [`api-contract.md`](./api-contract.md) | All REST endpoints + WebSocket events with request/response shapes, validation rules, status codes. **Includes Phase 2 (Knowledge Base) and Phase 4 (Client Tools) endpoints.** |
| [`database-schema.md`](./database-schema.md) | **11 tables** (post-Phase-4), enums, indexes, common queries, backup/restore. Includes pgvector extension + RAG tables + tool registry. |
| [`schema.ts`](./schema.ts) | Drizzle-ORM mirror of the Postgres schema (for TS typing). Updated with Phase 2/4 tables. |
| [`PRD.md`](./PRD.md) | Product requirements, feature matrix, MoSCoW priorities |

---

## Where to find things outside this folder

| Need | File |
|------|------|
| Project overview & quick start | [`../README.md`](../README.md) |
| **AI agent picking up from GitHub** | [`../.agent/00-START-HERE.md`](../.agent/00-START-HERE.md) ← 10-min bootstrap |
| AI agent skill pack (full) | [`../.agent/README.md`](../.agent/README.md) |
| How the system is put together | [`../ARCHITECTURE.md`](../ARCHITECTURE.md) |
| Local development workflow | [`../DEVELOPMENT.md`](../DEVELOPMENT.md) |
| Production deployment (generic Coolify) | [`../DEPLOY_COOLIFY.md`](../DEPLOY_COOLIFY.md) |
| Production deployment (our Tailscale setup) | [`../.agent/09-single-user-deployment.md`](../.agent/09-single-user-deployment.md) |
| Post-deploy smoke test (Phase 2-4) | [`../.agent/11-phase-2-4-deploy-smoke-test.md`](../.agent/11-phase-2-4-deploy-smoke-test.md) |
| Product roadmap & phase status | [`../.agent/10-commercial-mvp-roadmap.md`](../.agent/10-commercial-mvp-roadmap.md) |
| Autonomous agent TL;DR brief | [`../AI_AGENT_BRIEF.md`](../AI_AGENT_BRIEF.md) |
| Environment variable template | [`../.env.example`](../.env.example) |
| Database DDL (source of truth) | [`../backend/database/init.sql`](../backend/database/init.sql) |
| Live credentials (gitignored) | `../CREDENTIALS.md` |

---

## Maintenance rules

- Schema change → update `backend/database/init.sql` **and** `docs/database-schema.md` **and** `docs/schema.ts` **and** the corresponding GORM model in `backend/models/`.
- New endpoint → update `docs/api-contract.md` + register in `backend/routes/routes.go`.
- New env var → update `.env.example`, `lib/env.ts`, `lib/config.ts`, `backend/config/config.go`.
- Architectural change → update `ARCHITECTURE.md` **and** `.agent/01-architecture.md` (mental-model version for agents).
- New phase completed → update the status table in `.agent/10-commercial-mvp-roadmap.md` and append a dated entry to `.agent/07-task-log.md`.
