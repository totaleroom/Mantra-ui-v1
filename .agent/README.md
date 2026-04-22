# `.agent/` — Skill Pack for AI Coding Agents

> **You are an AI agent taking over work on Mantra AI.** This directory is
> written for you. Read it in the order below before touching code. The human
> operator expects you to already know what's here.

> **Fresh clone from GitHub?** Start with `00-START-HERE.md` for a 10-minute
> bootstrap. That file points you back here once you've got your bearings.

---

## Mission (copy this into your working memory)

Mantra AI is a **multi-tenant SaaS for AI-powered WhatsApp automation**,
targeted at Indonesian UMKM (small businesses). One VPS self-hosts the whole
stack via Coolify. MVP scope is **1–5 concurrent tenants** doing real customer
service via WhatsApp with AI auto-reply, enriched by a **per-tenant knowledge
base** (RAG) and **function-calling tools** (webhook or builtin).

**Success = a shopkeeper connects WhatsApp via QR, writes a system prompt once,
uploads an FAQ, and customers chatting their business number get AI replies
grounded in the tenant's data — all visible live on the dashboard.**

---

## Reading Order (do not skip)

| # | File | Why |
|---|------|-----|
| 0 | `00-START-HERE.md` | **First read** if you just cloned from GitHub. 10-minute bootstrap + handshake procedure. |
| 1 | `01-architecture.md` | Mental model. Data flow. How a customer message becomes an AI reply. |
| 2 | `02-codebase-map.md` | Where everything lives. Saves you 30 min of grep. |
| 3 | `03-conventions.md` | How to write code that fits. Security invariants. |
| 4 | `04-runbooks.md` | Copy-paste step-by-step for common tasks. |
| 5 | `05-gotchas.md` | Mistakes already made. Do not repeat them. |
| 6 | `06-verification.md` | How to prove your change works. Run before marking done. |
| 7 | `07-task-log.md` | What previous agents did. Append your entry when done. |
| 8 | `08-hermes-handoff.md` | **If you are Hermes**, this is your operating envelope. Read it end-to-end. |
| 9 | `09-single-user-deployment.md` | Actual deployment topology (Tailscale + Coolify, no public domain). |
| 10 | `10-commercial-mvp-roadmap.md` | **Product path.** Phase-by-phase status table is the authoritative "what's done". |
| 11 | `11-phase-2-4-deploy-smoke-test.md` | Post-deploy verification runbook for Knowledge Base + RAG + Tool Calling. |
| 12 | `12-vps-deploy-runbook.md` | **Exact command sequence** for a clean VPS deploy. Written after a previous Hermes session improvised and broke things. Do not skip steps. |

After reading, also glance at (in repo root):

- `README.md` — human-facing overview, has the message-flow diagram
- `ARCHITECTURE.md` — deeper technical architecture (includes RAG + tool flow)
- `DEPLOY_COOLIFY.md` — production deploy
- `CREDENTIALS.md` — plaintext secrets registry (gitignored). Only read if the
  user points you at it. Never echo secrets back in chat.
- `docs/api-contract.md` — all REST + WS endpoints with request/response shapes
- `docs/database-schema.md` — 11-table schema (post-Phase-4) with common queries
- `.windsurf/skills/ui-ux-pro-max/SKILL.md` — UI/UX design intelligence
  database (67 styles, 96 palettes, 57 font pairings, 99 UX rules, 25 chart
  types, 13 stacks). When any visual/UI work is requested, **start with**:
  `python .windsurf/skills/ui-ux-pro-max/scripts/search.py "<keywords>" --design-system -p "Mantra AI"`.
  Requires Python 3. Generated design systems can be persisted to
  `design-system/MASTER.md` + `design-system/pages/*.md` with `--persist`.
- `.windsurf/skills/frontend-design-pro/` — 11 aesthetic directions with
  **working HTML/CSS demos** at `demos-v02/*.html`. Skill spec at
  `skills/frontend-design-pro/SKILL.md`. Use when picking a distinctive
  look for a new page/feature: read the skill's opinionated rules
  (characterful fonts, asymmetry, signature details) + open the relevant
  demo HTML to see actual implementation. Styles #3 (Glassmorphism),
  #6 (Aurora Mesh), and #10 (Dark OLED Luxury) are closest matches to
  Mantra's current direction.

---

## Non-negotiable Rules

1. **Never commit secrets.** `.env*` and `CREDENTIALS.md` are gitignored. Keep
   it that way.
2. **Never delete tests** without explicit user permission.
3. **Minimal fix first.** If a one-line change solves it, stop there.
4. **Verify before claiming done.** See `06-verification.md`. No "should work"
   without running something.
5. **Write changes that pass `tsc --noEmit` and `next build`.** Dev server
   lying to you is common; build is truth.
6. **Preserve file-top imports.** Never add imports mid-file.
7. **Follow the user's preferred language.** They code-switch Bahasa
   Indonesia ↔ English. Match their last message.
8. **One task in progress at a time.** Use `todo_list` / `update_plan`.

---

## When you're stuck

- Read `05-gotchas.md` first — the answer is probably there.
- Grep the backend for the exact error string.
- If you're genuinely uncertain about *intent*, ask the user. If you're
  uncertain about *implementation*, read more code.
- Never invent libraries, env vars, or endpoints. Verify they exist.

---

## When you finish a work session

Append a dated entry to `07-task-log.md`:

```md
## YYYY-MM-DD — <short title>

**Agent**: <Cascade | Claude Code | Hermes | ...>

**What**: <1-2 sentences>

**Files changed**:
- `path/to/file` — 1-line why

**How verified**:
- <block from 06-verification.md you ran, + result>

**Follow-ups**:
- <anything you didn't finish>
```

This is how the next agent picks up without losing context. **The task log is
the single source of truth for "what just happened."** The *next* agent (or
you, in a new session) will read the top 3 entries before touching anything.
