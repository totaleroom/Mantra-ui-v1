# 00 — START HERE (Pick up from GitHub)

> **You are an AI coding agent who just cloned this repo from GitHub.**
> You have no prior memory of this project. This document bootstraps you
> from zero to productive in under 10 minutes. Read it top to bottom
> before doing anything else.

---

## Who you are, what this is

You are one of: **Cascade** (Windsurf), **Claude Code**, **Cursor**,
**Hermes** (our long-running agent on the VPS), or an equivalent.
Your job: continue implementing the **Mantra AI** commercial MVP.

**Mantra AI** is a multi-tenant SaaS for WhatsApp customer-service
automation targeting Indonesian UMKM. One VPS self-hosts the whole
stack. Current scale target: 1–5 paying tenants; grows to 20–50 on the
same topology.

## What state is the project in *right now*

1. Open `.agent/10-commercial-mvp-roadmap.md` — the Phase Progress table
   is the authoritative status.
2. Then open `.agent/07-task-log.md` (top entry = most recent) — this is
   the hand-off note from the previous agent. **Read at least the top 3
   entries** even if they look familiar. That's how you inherit context
   without re-reading the whole repo.

As of the last update:

- ✅ **Phase 0** — baseline (Next.js + Go + Postgres + Redis + Evolution)
- 🟡 **Phase 1** — visual polish (Tier 1 done, per-page audit pending)
- ✅ **Phase 2** — Knowledge Base (pgvector, chunks, FAQs, embedding)
- ✅ **Phase 3** — RAG retrieval wired into the orchestrator
- ✅ **Phase 4** — Tool calling (function calling + webhook/builtin)
- ⚪ **Phase 5** — Tiered model routing (next up)
- ⚪ **Phase 6** — Production hardening

---

## 10-minute bootstrap (do this in order)

### 1. Read these 4 files, in this order (≈6 min)

| # | File | Why |
|---|------|-----|
| 1 | `.agent/01-architecture.md` | The mental model. How a WhatsApp message becomes an AI reply. |
| 2 | `.agent/02-codebase-map.md` | Where every kind of code lives. Saves 30 min of grep. |
| 3 | `.agent/07-task-log.md` (top 3 entries) | What just happened. What state the code is in. |
| 4 | `.agent/10-commercial-mvp-roadmap.md` | What's done, what's next. |

### 2. Skim these 3 files (≈3 min)

| # | File | Why |
|---|------|-----|
| 5 | `.agent/03-conventions.md` | Security invariants and code style. Don't violate these. |
| 6 | `.agent/05-gotchas.md` | Mistakes previous agents made. Do not repeat them. |
| 7 | `.agent/06-verification.md` | How to prove your change works before claiming "done". |

### 3. Know where to look when stuck (≈1 min)

| Situation | Go to |
|-----------|-------|
| Don't know where some code lives | `.agent/02-codebase-map.md` |
| Need to run a command | `.agent/04-runbooks.md` |
| Got a weird error | `.agent/05-gotchas.md` first (answer is usually there) |
| Deploying to production | `.agent/09-single-user-deployment.md` (our actual topology) or `DEPLOY_COOLIFY.md` (public-topology fallback) |
| API shape / DB shape | `docs/api-contract.md` / `docs/database-schema.md` |
| Environment variables | `.env.example` (grouped, commented) |
| If you are **Hermes** specifically | `.agent/08-hermes-handoff.md` — your operating envelope |

---

## Minimum viable local setup

You probably don't need to run the stack locally — most tasks are
code-only. If you do:

```powershell
# Windows PowerShell (dev machine)
pnpm install
npx tsc --noEmit                  # verify frontend compiles
# Backend: run in Docker OR install Go 1.25 locally
docker compose up -d              # if you have Docker Desktop running
```

If Docker Desktop isn't running and you can't install Go locally, say so
in your response. **Do not pretend to verify Go code you can't compile.**
See `06-verification.md` § "Smoke test I can actually run right now".

---

## The standard workflow

```
1. Read the task from the operator.
2. Draft a concise plan (todo_list). Share it before coding.
3. Before touching anything non-trivial, update your plan based on
   what you just learned.
4. Make the minimal change. Follow 03-conventions.md.
5. Run verification:
   - Always: `npx tsc --noEmit` (frontend)
   - If Go changed: attempt `go vet ./... && go build ./...` via
     Docker; if impossible, do a manual cross-reference grep and
     SAY SO in your summary.
6. Append an entry to .agent/07-task-log.md describing:
   - What you changed (file list + 1-line why for each)
   - Why (business reason)
   - How you verified (which verification blocks you ran)
   - Follow-ups you couldn't finish
7. Report back to the operator with a concise summary.
```

---

## Non-negotiable rules

1. **Never commit secrets.** `.env*` and `CREDENTIALS.md` are gitignored.
   Never echo them in logs, chat, or commits.
2. **Never delete tests without explicit permission.**
3. **Minimal fix first.** A 1-line fix for a 1-line bug. Don't
   over-engineer.
4. **Verify before claiming done.** No "should work" without running
   something. If you can't run it, say so.
5. **Preserve file-top imports.** Never add imports mid-file.
6. **Match the operator's language.** They code-switch Bahasa ↔
   English. Match their last message.
7. **One task in progress at a time.** Use `todo_list` / `update_plan`.
8. **Append to `07-task-log.md` at the end of every work session.**
   This is how the *next* agent picks up.

---

## If you're Hermes (the on-VPS long-runner)

Your workflow is slightly different — you pull via `git`, work on
branches, and push for operator review. See `08-hermes-handoff.md` for
the exact envelope of what you can do without asking vs. what needs
approval. Read that end-to-end before touching the VPS.

---

## If something feels wrong

The doc says X, the code does Y, or the task log mentions something
that doesn't exist. Do not guess — do one of:

1. Grep the codebase for the mentioned symbol (`grep_search`).
2. Read the relevant `.agent/` file again, carefully.
3. Ask the operator with a **specific** question like "README says the
   DB is called `mantra`, but `docker-compose.yaml` has `mantra_db`.
   Which is correct?" — not "is the DB name right?".

---

## Your first move

1. Open `.agent/07-task-log.md`.
2. Read the top entry (newest date).
3. That tells you what the previous agent did and what the operator is
   likely to ask next.
4. When you're ready, ask the operator: "I'm caught up through
   `<top log entry title>`. What should I work on?"

Do **not** start editing code before this handshake unless the operator
explicitly told you to continue a specific task.

---

**You have enough to act. Go.**
