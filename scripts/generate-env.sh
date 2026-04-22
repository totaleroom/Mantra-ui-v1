#!/usr/bin/env bash
# =============================================================
# Mantra AI — one-shot .env generator
#
# Fills every REQUIRED secret with a strong random value and prompts
# only for the fields that MUST come from a human (public URL, tenant
# email). Designed so a fresh clone can boot with a single command.
#
# Usage:
#   ./scripts/generate-env.sh [--public-url=https://app.example.com] \
#                             [--evo-key=...] \
#                             [--write]   # write .env (default: print)
# =============================================================

set -euo pipefail

PUBLIC_URL=""
EVO_KEY=""
WRITE=0

for arg in "$@"; do
  case "$arg" in
    --public-url=*) PUBLIC_URL="${arg#*=}" ;;
    --evo-key=*)    EVO_KEY="${arg#*=}" ;;
    --write)        WRITE=1 ;;
    -h|--help)
      head -n 14 "$0" | tail -n 12 | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "unknown arg: $arg" >&2; exit 2 ;;
  esac
done

# ---- defaults if flags missing ------------------------------
if [ -z "$PUBLIC_URL" ]; then
  PUBLIC_URL="http://localhost:5000"
fi

# ---- URL parsing ---------------------------------------------
# The user's PUBLIC_URL may or may not include a port (e.g. sslip.io
# smoke-test uses "http://1-2-3-4.sslip.io:5000", prod uses
# "https://mantra.yourdomain.com" with implicit 443).
#
# We derive separate URLs for each service. Previous logic did
# `${PUBLIC_URL}:8080` which produced malformed "host:5000:8080" when
# the input already had a port. This block parses scheme+host cleanly.
SCHEME="${PUBLIC_URL%%://*}"           # http or https
HOST_PORT="${PUBLIC_URL#*://}"         # host[:port][/path]
HOST_PORT="${HOST_PORT%%/*}"           # strip any trailing path
HOST="${HOST_PORT%%:*}"                # host only (no port)
# FRONTEND_URL retains whatever port the user asked for (5000 for sslip).
# Service-specific URLs rebuild with their own ports from HOST.
EVO_URL_PUBLIC="${SCHEME}://${HOST}:8080"
BACKEND_URL_PUBLIC="${SCHEME}://${HOST}:3001"

# ---- random secret helpers ---------------------------------
rand_b64()  { openssl rand -base64 "${1:-32}" | tr -d '\n=' | tr '+/' '-_'; }
rand_hex()  { openssl rand -hex "${1:-16}"; }

JWT_SECRET="$(rand_b64 48)"
WEBHOOK_SECRET="$(rand_b64 32)"
POSTGRES_PASSWORD="$(rand_b64 24)"
HERMES_TOKEN="$(rand_hex 24)"

# Evolution API key — if user passed one, use it; else generate and warn.
if [ -z "$EVO_KEY" ]; then
  EVO_KEY="$(rand_b64 32)"
  EVO_GENERATED=1
else
  EVO_GENERATED=0
fi

# ---- compose .env body --------------------------------------
ENV_CONTENT=$(cat <<EOF
# ─── Core secrets (generated $(date -u +%FT%TZ)) ──────────
JWT_SECRET=${JWT_SECRET}
WEBHOOK_SECRET=${WEBHOOK_SECRET}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
HERMES_AUTH_TOKEN=${HERMES_TOKEN}

# ─── PostgreSQL ──────────────────────────────────────────
POSTGRES_USER=mantra
POSTGRES_DB=mantra_db
DATABASE_URL=postgres://mantra:${POSTGRES_PASSWORD}@postgres:5432/mantra_db?sslmode=disable

# ─── Redis ───────────────────────────────────────────────
REDIS_URL=redis://redis:6379

# ─── Evolution (WhatsApp gateway) ────────────────────────
EVO_API_KEY=${EVO_KEY}
# EVO_API_URL is backend->evolution via docker network (service name).
EVO_API_URL=http://evolution:8080
# EVOLUTION_SERVER_URL + NEXT_PUBLIC_EVO_URL are browser-reachable,
# so they use host:8080 (not host:5000:8080).
EVOLUTION_SERVER_URL=${EVO_URL_PUBLIC}
NEXT_PUBLIC_EVO_URL=${EVO_URL_PUBLIC}
NEXT_PUBLIC_EVO_INSTANCE_NAME=mantra_instance

# ─── Public URLs ─────────────────────────────────────────
# PUBLIC_BACKEND_URL is what Evolution calls for webhooks; it must
# reach the backend from wherever Evolution is running. For the
# bundled Evolution container we use the docker service name, for
# split deployments override this to the public API URL.
PUBLIC_BACKEND_URL=${BACKEND_URL_PUBLIC}
BACKEND_INTERNAL_URL=http://backend:3001
# FRONTEND_URL keeps the port the operator asked for (port 5000 for
# sslip.io smoke test, 443 for prod TLS). Same-origin rewrites in
# next.config mean NEXT_PUBLIC_API_URL + BACKEND_URL share it.
FRONTEND_URL=${PUBLIC_URL}
NEXT_PUBLIC_API_URL=${PUBLIC_URL}
NEXT_PUBLIC_WS_URL=${PUBLIC_URL/http/ws}
NEXT_PUBLIC_BACKEND_URL=${PUBLIC_URL}
NEXT_PUBLIC_BASE_URL=${PUBLIC_URL}

# ─── Runtime ─────────────────────────────────────────────
APP_ENV=production
NODE_ENV=production

# ─── Optional tuning (override if you know what you want) ─
# LIMIT_EMBED_TOKENS=200000
EOF
)

# ---- output --------------------------------------------------
if [ "$WRITE" = "1" ]; then
  if [ -e .env ]; then
    cp .env ".env.backup.$(date -u +%Y%m%d-%H%M%S)"
    echo "[env] existing .env backed up"
  fi
  printf '%s\n' "$ENV_CONTENT" > .env
  echo "[env] wrote .env"
else
  printf '%s\n' "$ENV_CONTENT"
fi

if [ "$EVO_GENERATED" = "1" ]; then
  echo ""
  echo "⚠  Evolution API key was auto-generated. The Evolution container"
  echo "   will accept this only if you're running the bundled instance."
  echo "   If you BYO Evolution, pass --evo-key=<existing-key>." >&2
fi
