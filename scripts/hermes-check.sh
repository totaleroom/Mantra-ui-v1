#!/usr/bin/env bash
# Hermes pre-flight check.
# Run at the start of every Hermes session on the VPS.
# Exit non-zero if anything is wrong — Hermes must report to operator.
#
# Usage:
#   bash scripts/hermes-check.sh                      # auto-detect repo root
#   REPO_ROOT=/path/to/repo bash scripts/hermes-check.sh   # explicit override
#
# REPO_ROOT resolution order (first match wins):
#   1. $REPO_ROOT env var (explicit override)
#   2. `git rev-parse --show-toplevel` from the script's own directory
#   3. Parent directory of this script's /scripts/ folder
#   4. Hard-coded legacy fallback (/opt/mantra) — emits a warning
set -uo pipefail

resolve_repo_root() {
  # 1. Explicit override
  if [ -n "${REPO_ROOT:-}" ]; then
    echo "$REPO_ROOT"
    return
  fi

  # Where this script actually lives on disk
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

  # 2. Walk up with git
  if command -v git >/dev/null 2>&1; then
    local git_root
    git_root="$(cd "$script_dir" && git rev-parse --show-toplevel 2>/dev/null || true)"
    if [ -n "$git_root" ] && [ -d "$git_root/.git" ]; then
      echo "$git_root"
      return
    fi
  fi

  # 3. Script is in $REPO_ROOT/scripts/ by convention — go up one level
  local parent
  parent="$(dirname "$script_dir")"
  if [ -f "$parent/docker-compose.yaml" ] || [ -d "$parent/.agent" ]; then
    echo "$parent"
    return
  fi

  # 4. Legacy fallback
  echo "/opt/mantra"
}

REPO_ROOT="$(resolve_repo_root)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.yaml"

red()    { printf '\033[31m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
bold()   { printf '\033[1m%s\033[0m\n' "$*"; }

FAIL=0
WARN=0

check() {
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then
    green "  ✓ $name"
  else
    red "  ✗ $name"
    FAIL=$((FAIL + 1))
  fi
}

warn_if() {
  local name="$1"; shift
  if "$@" >/dev/null 2>&1; then
    green "  ✓ $name"
  else
    yellow "  ! $name"
    WARN=$((WARN + 1))
  fi
}

bold "== Hermes Pre-flight Check =="
echo "   REPO_ROOT   = $REPO_ROOT"
echo "   COMPOSE_FILE = $COMPOSE_FILE"
if [ "$REPO_ROOT" = "/opt/mantra" ] && [ ! -d "/opt/mantra" ]; then
  yellow "   ! resolved REPO_ROOT to legacy default /opt/mantra which does not exist."
  yellow "   ! export REPO_ROOT=/path/to/your/checkout or run this script from inside the repo."
fi
echo

bold "Tools"
check "git installed"               command -v git
check "docker installed"            command -v docker
check "docker compose v2"           docker compose version
check "curl installed"              command -v curl
check "jq installed"                command -v jq
check "openssl installed"           command -v openssl
warn_if "go 1.25 installed (optional, have Docker fallback)"  bash -c 'go version 2>/dev/null | grep -q "go1\.25"'
warn_if "psql client installed (optional)"  command -v psql
echo

bold "Repository"
check "repo directory exists"       test -d "$REPO_ROOT"
check "repo is a git checkout"      test -d "$REPO_ROOT/.git"
if [ -d "$REPO_ROOT/.git" ]; then
  # Only fail on *modified tracked* files (lines starting with ' M', 'M ', 'MM',
  # 'A ', 'D ', 'R ', etc.). Untracked files (lines starting with '??') belong
  # to the operator — things like .env, .env2, .windsurf/, local notes —
  # and do not block `git pull --ff-only`, so they are not our concern here.
  check "repo has clean tracked tree (untracked files ignored)" \
    bash -c "cd '$REPO_ROOT' && test -z \"\$(git status --porcelain | grep -v '^??')\""
  check "remote origin reachable"   bash -c "cd '$REPO_ROOT' && git ls-remote --exit-code origin HEAD"

  # Surface what IS untracked so the operator is aware — warn, don't fail.
  UNTRACKED_COUNT=$(cd "$REPO_ROOT" && git status --porcelain | grep -c '^??' || true)
  if [ "${UNTRACKED_COUNT:-0}" -gt 0 ]; then
    yellow "  ! ${UNTRACKED_COUNT} untracked path(s) present (informational; not a failure)"
    WARN=$((WARN + 1))
  fi
fi
check ".agent/ directory present"   test -d "$REPO_ROOT/.agent"
check "compose file present"        test -f "$COMPOSE_FILE"
echo

bold "Credentials"
warn_if ".env file present (may live in Coolify instead)"  test -f "$REPO_ROOT/.env"
warn_if "CREDENTIALS.md present"    test -f "$REPO_ROOT/CREDENTIALS.md"
warn_if "GitHub SSH key present"    test -f "$HOME/.ssh/hermes_github"
echo

bold "Docker runtime"
check "docker daemon reachable"     docker ps
if docker ps >/dev/null 2>&1; then
  for svc in postgres redis evolution backend frontend; do
    check "service '$svc' running"  bash -c "docker compose -f '$COMPOSE_FILE' ps --format json 2>/dev/null | grep -q '\"Service\":\"$svc\"' && docker compose -f '$COMPOSE_FILE' ps $svc --format json | grep -q '\"State\":\"running\"'"
  done
fi
echo

bold "Backend health"
if curl -sSf --max-time 5 http://localhost:3001/health >/dev/null 2>&1; then
  HEALTH=$(curl -sS http://localhost:3001/health)
  green "  ✓ /health responded"
  echo "    $HEALTH" | head -c 300
  echo
else
  red "  ✗ /health did not respond in 5s"
  FAIL=$((FAIL + 1))
fi
echo

bold "Disk & memory"
FREE_PCT=$(df -P "$REPO_ROOT" | awk 'NR==2 { gsub(/%/,"",$5); print 100-$5 }')
if [ "${FREE_PCT:-0}" -ge 20 ]; then
  green "  ✓ disk free: ${FREE_PCT}%"
else
  red "  ✗ disk free: ${FREE_PCT}% (threshold 20%)"
  FAIL=$((FAIL + 1))
fi
FREE_MEM_MB=$(free -m | awk '/^Mem:/ { print $7 }')
if [ "${FREE_MEM_MB:-0}" -ge 256 ]; then
  green "  ✓ available memory: ${FREE_MEM_MB} MB"
else
  yellow "  ! available memory: ${FREE_MEM_MB} MB (threshold 256 MB)"
  WARN=$((WARN + 1))
fi
echo

bold "Tailscale (single-user deploy)"
warn_if "tailscaled running"        systemctl is-active tailscaled
warn_if "tailscale up (authenticated)"  bash -c "tailscale status 2>/dev/null | grep -q '^100\.'"
echo

bold "Summary"
if [ "$FAIL" -eq 0 ] && [ "$WARN" -eq 0 ]; then
  green "ALL GREEN — Hermes may proceed."
  exit 0
elif [ "$FAIL" -eq 0 ]; then
  yellow "PASS WITH WARNINGS ($WARN) — Hermes may proceed but note the warnings."
  exit 0
else
  red "FAIL ($FAIL errors, $WARN warnings) — Hermes must stop and report to operator."
  exit 1
fi
