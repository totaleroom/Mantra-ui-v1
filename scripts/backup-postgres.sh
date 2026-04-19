#!/usr/bin/env bash
# =============================================================
# Mantra AI — PostgreSQL backup script
# Run daily via cron on the Docker host (NOT inside the container).
# Retains 7 daily snapshots + 4 weekly + 3 monthly, rotating oldest.
#
# Recommended cron (as root on the VPS):
#   0 3 * * * /opt/mantra/scripts/backup-postgres.sh >> /var/log/mantra-backup.log 2>&1
# =============================================================

set -euo pipefail

# ---- Config (override via env) ------------------------------
BACKUP_DIR="${BACKUP_DIR:-/var/backups/mantra}"
CONTAINER="${POSTGRES_CONTAINER:-postgres}"
DB_NAME="${POSTGRES_DB:-mantra_db}"
DB_USER="${POSTGRES_USER:-mantra}"

DAILY_KEEP=7
WEEKLY_KEEP=4
MONTHLY_KEEP=3

# ---- Derived paths ------------------------------------------
STAMP="$(date -u +%Y%m%d-%H%M%S)"
DOW="$(date -u +%u)"   # 1=Mon..7=Sun
DOM="$(date -u +%d)"   # 01..31

mkdir -p "$BACKUP_DIR"/{daily,weekly,monthly}

DAILY_FILE="$BACKUP_DIR/daily/mantra-$STAMP.sql.gz"

# ---- Dump ---------------------------------------------------
echo "[backup] starting $DAILY_FILE"
docker exec "$CONTAINER" pg_dump \
    --clean --if-exists --no-owner --no-privileges \
    -U "$DB_USER" -d "$DB_NAME" \
  | gzip -9 > "$DAILY_FILE"

SIZE="$(stat -c%s "$DAILY_FILE")"
if [ "$SIZE" -lt 10000 ]; then
  echo "[backup] ERROR: dump is suspiciously small ($SIZE bytes) — aborting"
  rm -f "$DAILY_FILE"
  exit 1
fi
echo "[backup] ok ($SIZE bytes)"

# ---- Promote weekly (Sundays) -------------------------------
if [ "$DOW" = "7" ]; then
  cp "$DAILY_FILE" "$BACKUP_DIR/weekly/mantra-$STAMP.sql.gz"
fi
# ---- Promote monthly (1st of month) ------------------------
if [ "$DOM" = "01" ]; then
  cp "$DAILY_FILE" "$BACKUP_DIR/monthly/mantra-$STAMP.sql.gz"
fi

# ---- Retention ---------------------------------------------
prune() {
  local dir="$1" keep="$2"
  # List newest first, skip the first $keep, delete the rest.
  ls -1t "$dir"/mantra-*.sql.gz 2>/dev/null | awk -v k="$keep" 'NR>k' | xargs -r rm -f
}
prune "$BACKUP_DIR/daily"   "$DAILY_KEEP"
prune "$BACKUP_DIR/weekly"  "$WEEKLY_KEEP"
prune "$BACKUP_DIR/monthly" "$MONTHLY_KEEP"

echo "[backup] retention applied"
echo "[backup] done"
