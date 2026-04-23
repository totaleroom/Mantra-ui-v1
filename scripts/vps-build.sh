#!/usr/bin/env bash
# ============================================================
# scripts/vps-build.sh
#
# Runs `docker compose up -d --build` in a way that survives a
# shell that has a short command-timeout window (e.g. Hermes agent's
# 60-second per-call limit). Without this wrapper the CLI caller
# disconnects mid-build and operators have no visibility into the
# daemon-side progress.
#
# Behaviour:
#   1. Launch the build in a true background process via nohup +
#      disown; redirect all output to /tmp/mantra-build.log.
#   2. Poll container status every `SLEEP` seconds up to `MAX_ITER`
#      iterations. Each poll is sub-second so the caller's per-call
#      timeout never trips.
#   3. Exit 0 when all 5 expected services are running, or 1 if the
#      ceiling is hit. The build itself is never killed by this script —
#      the operator can re-run vps-build.sh to resume polling.
#
# Requires: docker, docker compose, awk, grep. No sudo.
# Idempotent: re-running while a build is in flight just polls the
# existing build.
# ============================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

COMPOSE_FILES=(-f docker-compose.yaml -f docker-compose.public.yaml)
LOG_FILE="/tmp/mantra-build.log"
SLEEP="${VPS_BUILD_SLEEP:-45}"        # override via env if you want slower/faster poll
MAX_ITER="${VPS_BUILD_MAX_ITER:-20}"  # 20 * 45s = 15 min ceiling
EXPECTED_RUNNING="${VPS_BUILD_EXPECTED:-5}"

echo "=== mantra vps build helper ==="
echo "project:   $PROJECT_ROOT"
echo "log file:  $LOG_FILE"
echo "sleep:     ${SLEEP}s   max iter: $MAX_ITER   expected running: $EXPECTED_RUNNING"
echo ""

# --- 0. sanity ---------------------------------------------------
if [ ! -f ".env" ]; then
  echo "ERROR: .env is missing. Run ./scripts/generate-env.sh first." >&2
  exit 2
fi
if [ ! -f "docker-compose.public.yaml" ]; then
  echo "ERROR: docker-compose.public.yaml is missing. This file is committed to" >&2
  echo "       the repo; verify you're on origin/main." >&2
  exit 2
fi

# --- 1. detect existing in-flight build --------------------------
ALREADY_RUNNING=0
if pgrep -f "docker.*compose.*up.*--build" > /dev/null 2>&1; then
  ALREADY_RUNNING=1
  echo "Build already in progress (pgrep found running docker compose). Skipping kickoff."
fi

# --- 2. kick off build in true background ------------------------
if [ "$ALREADY_RUNNING" = "0" ]; then
  echo "Kicking off build in background..."
  nohup docker compose "${COMPOSE_FILES[@]}" up -d --build > "$LOG_FILE" 2>&1 &
  BUILD_PID=$!
  disown "$BUILD_PID" 2>/dev/null || true
  echo "Build PID: $BUILD_PID"
  echo ""
  sleep 2  # give docker a moment to actually start writing the log
fi

# --- 3. poll until all 5 services are running -------------------
echo "Polling for all $EXPECTED_RUNNING containers to be Up (each poll < 3s)..."
echo ""
for i in $(seq 1 "$MAX_ITER"); do
  TIMESTAMP=$(date '+%H:%M:%S')
  RUNNING=$(docker compose "${COMPOSE_FILES[@]}" ps --status=running -q 2>/dev/null | wc -l)
  TOTAL=$(docker compose "${COMPOSE_FILES[@]}" ps -a -q 2>/dev/null | wc -l)

  # Detect container that has exited with non-zero — usually OOM (137) or build failure.
  FAILED=$(docker compose "${COMPOSE_FILES[@]}" ps -a --format '{{.Name}} {{.Status}}' 2>/dev/null \
    | grep -E "Exited \([1-9][0-9]*\)" | head -3 || true)

  LAST_LOG=$(tail -1 "$LOG_FILE" 2>/dev/null | cut -c 1-120)

  printf "[%02d/%02d %s]  running=%s/%s  log: %s\n" \
    "$i" "$MAX_ITER" "$TIMESTAMP" "$RUNNING" "$TOTAL" "${LAST_LOG:-<empty>}"

  if [ -n "$FAILED" ]; then
    echo ""
    echo "FAILURE: one or more containers exited non-zero:"
    echo "$FAILED"
    echo ""
    echo "Build log tail:"
    tail -30 "$LOG_FILE" 2>/dev/null
    exit 3
  fi

  if [ "$RUNNING" = "$EXPECTED_RUNNING" ]; then
    echo ""
    echo "✓ All $EXPECTED_RUNNING containers running."
    break
  fi

  sleep "$SLEEP"
done

# --- 4. final status -------------------------------------------
echo ""
echo "=== final status ==="
docker compose "${COMPOSE_FILES[@]}" ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "=== backend boot banner (last 30 lines matching checklist) ==="
docker compose "${COMPOSE_FILES[@]}" logs backend --tail=200 2>/dev/null \
  | grep -B2 -A 25 "Boot Report" \
  || docker compose "${COMPOSE_FILES[@]}" logs backend --tail=40 2>/dev/null

echo ""
echo "=== health ==="
curl -sS --max-time 5 http://localhost:3001/health 2>&1 || echo "(backend not answering yet; give it 30s and curl again)"
echo ""

echo "=== done ==="
echo "Re-run vps-build.sh any time to re-poll the current stack state."
