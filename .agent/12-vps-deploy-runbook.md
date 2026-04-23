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
# 1. You are on the VPS in the repo checkout. Canonical path:
REPO=/root/project/web-apps/Mantra-ui-v1
cd "$REPO"
pwd                               # → /root/project/web-apps/Mantra-ui-v1
whoami                            # → root (this VPS; ops may change this)

# 2. Confirm tool versions. If any missing, STOP and report.
docker --version                  # ≥ 24
docker compose version            # ≥ v2.20
git --version                     # any recent
node --version                    # ≥ 20
pnpm --version                    # ≥ 9 — install with: npm i -g pnpm@latest

# 3. Confirm you are on the canonical remote.
git remote -v                     # must show exactly:
                                  #   origin  https://github.com/totaleroom/Mantra-ui-v1.git (fetch)
                                  #   origin  https://github.com/totaleroom/Mantra-ui-v1.git (push)
                                  # if different, STOP — someone changed the canonical URL.
git status                        # must be clean (tracked files) — untracked
                                  # operator-owned files (.env2, .windsurf/) are fine
```

If `git status` shows **modified tracked** files from a previous
session, that is real dirt and needs action:

```bash
# Default — safe, keeps diff recoverable for 30 days
git stash push -m "hermes-previous-session" -- <modified-tracked-files>

# Only if operator has explicitly approved a clean slate:
git checkout HEAD -- <modified-tracked-files>
```

**Do NOT** `git stash -u` (which sweeps up untracked files too) or
`git clean -fd` — both would delete the operator's untracked
working files (`.env2`, `.windsurf/`, local notes) which are not
your domain. See G26 in `05-gotchas.md`.

---

## Step 1 — Pull the canonical source

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git log -1 --oneline                # note the commit you're deploying

# Shell scripts now carry their +x bit in the git index (committed
# via `git update-index --chmod=+x scripts/*.sh` — see G26). A fresh
# `git pull` on Linux gives you mode 0755 automatically. This chmod
# is defensive only, in case someone re-committed without the +x bit.
chmod +x scripts/*.sh
ls -l scripts/*.sh                  # verify each shows "x" in the owner bits
```

If `git pull` reports non-fast-forward, there are local commits you
shouldn't have. STOP and report the log.

---

## Step 2 — Generate the .env (operator pre-approved ONLY)

**First-time deploy only.** If `.env` already exists and the backend
is healthy, DO NOT re-run this — it rotates every secret including
`JWT_SECRET`, which invalidates every active session and every signed
artifact. See G17 in `05-gotchas.md`.

```bash
# On THIS VPS the operator ran this once with:
#   --public-url=http://43-157-223-29.sslip.io:5000
# which produced the plain-HTTP sslip.io deployment. If you are
# re-deploying to a real domain later, use that domain instead.
./scripts/generate-env.sh --public-url=<public-url> --write
```

This VPS has three stale env backups at the repo root (`.env2`,
`.env.backup`, `.env.bak`) from past runs. They are **not** active—
only `.env` is read by Coolify. Do not delete the backups without
operator approval; they may contain rotated secrets that need to
be audited before disposal.

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

The base `docker-compose.yaml` keeps service ports internal so Coolify's
Traefik can route them. For a smoke-test on a bare VPS reached via
sslip.io, layer on `docker-compose.public.yaml` (committed to the repo)
which binds 5000 / 3001 / 8080 to the host.

> **Current deploy (2026-04-23)**: this VPS is running the `public`
> overlay — port 5000 is exposed directly on the host and reachable
> at `http://43-157-223-29.sslip.io:5000`. No TLS, no Traefik on top.
> When the operator points a real domain at this server, Traefik/
> Coolify TLS will take over and the public overlay becomes unneeded.

```bash
# --- 3a. Pull large images first so Docker Hub errors surface clearly ---
docker pull pgvector/pgvector:pg15
docker pull redis:7-alpine
docker pull evoapicloud/evolution-api:v2.3.7

# --- 3b. Kick off the actual build via the helper ---
# `scripts/vps-build.sh` wraps `docker compose up -d --build` in
# nohup + disown so it survives short CLI timeouts (Hermes's 60 s
# envelope), redirects output to /tmp/mantra-build.log, then polls
# container state every 45 s until all 5 services are Running.
#
# On a 4 GB VPS the first Next.js build usually takes 10–15 min
# because it swaps; the helper waits up to 15 min before giving up.
# Re-run the helper any time to re-poll — it won't double-build.
./scripts/vps-build.sh
```

Expected milestones in `/tmp/mantra-build.log`:

- `FROM golang:1.25-alpine ...` then backend `go build` finishes first
- `[frontend builder] Creating optimized production build`
- `[frontend builder] Compiled successfully`
- `[frontend builder] Generating static pages`
- Compose converges: postgres / redis / evolution / backend / frontend all "Running"

If any container stays `Restarting`, do NOT edit code or compose yet.
Read its logs first:

```bash
docker compose logs <service> --tail=120
```

(You are in the repo directory thanks to Step 0, so `docker compose`
infers the compose file and project name automatically. Don't pass
`-f` flags unless you need to override.)

**OOM kill signal**: if `docker compose ps -a` shows a service
`Exited (137)`, the kernel OOM-killed it. The frontend Dockerfile caps
Node heap at 1.5 GB to prevent this on 4 GB VPS, but if you still hit
it, add a 4 GB swap file:

```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile \
  && sudo mkswap /swapfile && sudo swapon /swapfile \
  && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Then re-run `./scripts/vps-build.sh`.

---

## Step 4 — Read the boot banner

`vps-build.sh` already prints this at the end of its run. To re-fetch:

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
# From the VPS itself (localhost, before any public routing):
curl -s http://localhost:3001/health | jq
# → expect {"status":"ok", "db":"connected", "redis":"connected", ...}

# Through the public URL.
# On THIS VPS (no TLS, sslip.io) use plain http + port 5000:
curl -s http://43-157-223-29.sslip.io:5000/api/system/preflight \
     -H "Cookie: mantra_session=<super-admin-jwt>" | jq '.overall, .checks[]|select(.status!="ok")'

# When the operator attaches a real domain + Traefik/Coolify TLS,
# switch to:
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
Summary — substitute your deployment's public URL in place of
`<public-url>`:

- Current VPS: `http://43-157-223-29.sslip.io:5000` (plain HTTP).
- Future w/ domain: `https://mantra.<operator-domain>`.

1. `<public-url>/login` → log in with `admin@mantra.ai` / bootstrap password.
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
## <DATE> — Deploy <commit-short-hash> to <public-url>

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
