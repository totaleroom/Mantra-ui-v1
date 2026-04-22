# 12 — VPS Deploy Runbook (Hermes, follow step-by-step)

> This runbook exists because the previous Hermes session improvised —
> swapping `pnpm` for `npm`, relaxing `tsconfig`, pulling a "v2 from
> Google Drive" on top of the git checkout, adding `drizzle-orm`
> (which the codebase doesn't import). Every one of those steps made
> the final state worse, not better.
>
> **If any step below fails, STOP and report the exact error.
> DO NOT improvise. DO NOT swap tools. DO NOT edit configs to force
> a pass. The failure IS the signal — it's telling you something
> concrete that the operator needs to know.**

---

## Pre-flight

```bash
# 1. You are on the VPS, in /opt/mantra, as the deploy user.
pwd                               # → /opt/mantra
whoami                            # → deploy (or whatever ops chose)

# 2. Confirm tool versions. If any missing, STOP and report.
docker --version                  # ≥ 24
docker compose version            # ≥ v2.20
git --version                     # any recent
node --version                    # ≥ 20
pnpm --version                    # ≥ 9 — install with: npm i -g pnpm@latest

# 3. Confirm you are on the canonical remote.
git remote -v                     # must show the operator's github.com repo
git status                        # must be clean or report EXACTLY what changed
```

If `git status` shows any modified / untracked files from a previous
session, run:

```bash
git stash push -u -m "hermes-previous-session"
# or, if you are ABSOLUTELY sure those changes are garbage:
git reset --hard origin/main && git clean -fd
```

The second form is only okay when the operator has approved a full
reset. Otherwise stash and report.

---

## Step 1 — Pull the canonical source

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git log -1 --oneline                # note the commit you're deploying

# Shell scripts lose their +x bit when committed from a Windows workstation.
# Set them executable unconditionally — idempotent, safe to re-run.
chmod +x scripts/*.sh
ls -l scripts/*.sh                  # verify each shows "x" in the owner bits
```

If `git pull` reports non-fast-forward, there are local commits you
shouldn't have. STOP and report the log.

---

## Step 2 — Generate the .env (operator pre-approved)

```bash
# Creates /opt/mantra/.env with strong random secrets + URLs derived
# from --public-url. Auto-backs up any existing .env.
./scripts/generate-env.sh --public-url=https://mantra.<operator-domain> --write
```

If you hit `Permission denied`, Step 1's `chmod +x` was skipped. Go back.

If `scripts/generate-env.sh` is missing, the repo is older than Phase B
or you are not at the right commit. Re-check `git log -1`.

Verify the file exists and has sane length:

```bash
stat -c '%s %n' .env               # should report ≥ 700 bytes
grep -c '^[A-Z_]*=' .env           # should report ≥ 18 lines set
```

---

## Step 3 — Build + boot containers

```bash
# Pull large images first so you can see Docker Hub errors clearly.
docker pull pgvector/pgvector:pg15
docker pull redis:7-alpine
docker pull atendai/evolution-api:v2.2.3

# Now the full stack. This builds backend + frontend images.
docker compose up -d --build
```

Expected output:

- `postgres` Started
- `redis`    Started
- `evolution` Started (healthy after ~15s)
- `backend`  Started — may take 60–90s for first compile
- `frontend` Started — may take 3–5 min for first Next.js build

If any container stays `Restarting`, do NOT edit code or compose yet.
Read its logs first:

```bash
docker compose logs <service> --tail=120
```

---

## Step 4 — Read the boot banner

```bash
docker compose logs backend --tail=60 | grep -A 20 "Boot Report"
```

You will see a pretty-printed checklist. Every line is a gate.
See `.agent/02-codebase-map.md` for the source (`boot_banner.go`).

- All `✓` → proceed to Step 5.
- Any `!` (warn) → note it, proceed to Step 5, mention in handoff.
- Any `✗` (fail) **in production mode** → the backend will have
  already called `log.Fatal` and refused to start. The banner tells
  you EXACTLY which env var is wrong. Fix that value in `.env`, then:

  ```bash
  docker compose up -d --force-recreate backend
  ```

---

## Step 5 — Query the preflight blackbox

This is the authoritative health report, machine-readable.

```bash
# From the VPS itself (localhost, before DNS / TLS):
curl -s http://localhost:3001/health | jq
# → expect {"status":"ok", "db":"connected", "redis":"connected", ...}

# Through the public domain (after Coolify/Traefik TLS):
curl -s https://api.<operator-domain>/api/system/preflight \
     -H "Cookie: mantra_session=<super-admin-jwt>" | jq '.overall, .checks[]|select(.status!="ok")'
```

If `overall == "ok"` or `overall == "warn"` → deployment is healthy.
If `overall == "fail"` → the response body enumerates the failing
checks with `remediation` strings. Follow those. Do NOT invent your
own fix.

---

## Step 6 — Smoke-test (browser, ~3 min)

Use the checklist in `.agent/11-phase-2-4-deploy-smoke-test.md`.
Summary:

1. `https://mantra.<domain>/login` → login with `admin@mantra.ai` / default password.
2. App must redirect to `/change-password`. Rotate to a real password.
3. App must land on `/` (dashboard overview). No 404.
4. `/diagnosis` must render the Blackbox panel with all checks green.
5. `/inbox` must render an empty list without error.

If ANY step fails, log into `docker compose logs backend --tail=200`
and `docker compose logs frontend --tail=200`, then report.

---

## Step 7 — Append task log

One entry in `.agent/07-task-log.md`, top of file:

```md
## <DATE> — Deploy <commit-short-hash> to <domain>

**Agent**: Hermes on <hostname>

**What**: …
**Verification**: preflight overall=<status>; smoke-test steps 1–5 <pass/fail>.
**Follow-ups**: …
```

Commit that entry:

```bash
git add .agent/07-task-log.md
git commit -m "log: deploy <commit-short-hash>"
git push origin main     # ← requires operator approval per 08-hermes-handoff.md
```

---

## What to NEVER do if something breaks

Learn from the previous session's mistakes. If the build fails:

| Tempting wrong fix | What you SHOULD do |
|---|---|
| `npm install` instead of `pnpm install` | Install pnpm: `npm i -g pnpm@latest` |
| Edit `tsconfig.json` to silence the type error | Read the error, fix the type, or report |
| `rsync ~/Downloads/mantra-v2/. /opt/mantra/` | Never. The GitHub repo is the source. |
| `pnpm add drizzle-orm` because tsc says so | `grep -r "drizzle" .` first. If zero imports, the dep is not missing. |
| `docker compose down -v && up` to "start fresh" | `-v` deletes postgres volume. Ask before. |
| Truncate / rewrite `docker-compose.yaml` | `cp` backup first, use `git checkout` to restore on mistake |

If you hit a wall, **report the exact error + your current
understanding + the 2 candidate fixes you considered**. Let the
operator pick. That's 10× more valuable than a green build that
hides a corrupted state.
