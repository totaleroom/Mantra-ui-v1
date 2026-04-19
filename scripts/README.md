# Mantra AI — Operator Scripts

Small, boring shell scripts that run on the Docker **host** (not inside a
container) to cover the operational gaps Coolify doesn't handle for you.

## `backup-postgres.sh`

Daily `pg_dump` → gzip → rotated retention.

**Install on the VPS:**

```bash
sudo install -m 755 scripts/backup-postgres.sh /opt/mantra/backup-postgres.sh
sudo tee /etc/cron.d/mantra-backup <<'EOF'
# Daily 03:00 UTC backup
0 3 * * * root /opt/mantra/backup-postgres.sh >> /var/log/mantra-backup.log 2>&1
EOF
```

**Verify:**

```bash
sudo /opt/mantra/backup-postgres.sh      # run once manually
ls -lh /var/backups/mantra/daily/        # should see one .sql.gz
```

**Restore:**

```bash
gunzip -c /var/backups/mantra/daily/mantra-YYYYMMDD-HHMMSS.sql.gz \
  | docker exec -i postgres psql -U mantra -d mantra_db
```

**Retention:** 7 daily + 4 weekly (Sundays) + 3 monthly (1st of month).
Tune the `*_KEEP` constants at the top of the script.

**Off-box copy (recommended):** wrap the script or append an `rclone copy`
step to push `/var/backups/mantra/` to S3 / Backblaze / a second VPS. A
backup sitting on the same disk as the DB is one `rm -rf` away from
being useless.
