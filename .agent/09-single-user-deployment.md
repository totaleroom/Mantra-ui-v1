# 09 — Single-User Deployment (Tailscale + Coolify)

> This project's default deployment target assumed multiple tenants on a
> public domain. The **actual deployment** for this operator is different:
> one person, one VPS, private network only, Coolify + Tailscale.
> This file documents the simplifications that apply.

---

## Simplifications vs. the generic README

| Generic README assumes | Actual setup |
|------------------------|--------------|
| Public domain with SSL via Let's Encrypt | **Tailscale private network.** No public domain. |
| Traefik binds to 80/443 on internet | Traefik binds to Tailscale interface (`100.x.y.z`) |
| UFW open 22/80/443 | UFW open **only 22** (SSH); plus Tailscale-managed virtual interface |
| Anyone on internet could hit `/login` | Only operator's Tailscale-authenticated devices can reach anything |
| Multi-tenant quotas matter | One tenant, quotas informational only |
| Webhook needs public URL | Webhook loopback: Evolution → backend is **container-internal** (`http://backend:3001`). No public URL required. |

---

## Required network topology

```
           ┌─ Operator's phone (Tailscale client) ──┐
           │                                        │
           │                                        ▼
Tailnet ───┼──► VPS (Tailscale client)
           │      │
           │      ├─ Coolify (port 8000 on tailnet)
           │      └─ Mantra stack (containers)
           │            ├─ frontend :5000 ─ exposed to tailnet via Traefik
           │            ├─ backend  :3001 ─ exposed to tailnet via Traefik
           │            ├─ evolution :8080 ─ container-internal ONLY
           │            ├─ postgres :5432 ─ container-internal ONLY
           │            └─ redis    :6379 ─ container-internal ONLY
           │
           └─ Laptop (Tailscale client) ─────────────┘
```

**Port `:8080` for Evolution is NOT exposed on the host** — it only speaks to
the backend container on the shared Docker network. The webhook URL therefore
is `http://backend:3001/api/webhooks/evolution` (Docker DNS).

This is the single biggest difference from the generic public deploy and
eliminates the entire "need public HTTPS for webhook" problem.

---

## Env var overrides for this topology

In Coolify service env for **backend**:

```env
PUBLIC_BACKEND_URL=http://backend:3001
# ^ container hostname, used when auto-registering the webhook.
# If you migrate to a public domain later, change to https://api.yourdomain.com
```

In Coolify service env for **frontend**:

```env
NEXT_PUBLIC_API_URL=http://mantra-vps:3001
NEXT_PUBLIC_WS_URL=ws://mantra-vps:3001
# ^ where 'mantra-vps' is the Tailscale MagicDNS name of your VPS.
# Or use the tailnet IP: http://100.64.1.2:3001
```

If you use Tailscale HTTPS (Funnel or self-assigned cert) you'd prefix `https`
/ `wss`. Funnel is OFF by default — keeps things private.

---

## One-time VPS setup checklist

Operator runs these; Hermes doesn't unless explicitly delegated.

```bash
# 1. Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --hostname=mantra-vps

# 2. Install Coolify (already in README)
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

# 3. Restrict Coolify UI to tailnet
#    Coolify Settings → Server → bind to 100.x.x.x instead of 0.0.0.0

# 4. Create project in Coolify
#    - Source: GitHub repo (private), install GitHub App or use deploy key
#    - Build pack: Docker Compose → uses docker-compose.yaml
#    - Domains: leave blank OR use <something>.<tailnet>.ts.net (MagicDNS)
#    - Fill env vars from CREDENTIALS.md

# 5. Install Hermes
#    (procedure is operator-specific; not documented here)

# 6. Test full flow — follow README Post-deploy Smoke Test, but replace
#    https://api.yourdomain.com with http://mantra-vps:3001
```

---

## Firewall rules

```bash
# On VPS, after Tailscale is up:
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow in on tailscale0   # tailnet-internal: all ports open
sudo ufw enable
```

**No `allow 80/tcp` or `allow 443/tcp`.** The internet cannot reach the
dashboard. The only way in is SSH (for ops) or via Tailscale (for use).

---

## Backups (single-user minimum viable)

```bash
# /opt/mantra/scripts/backup.sh — create this, add to cron nightly
#!/usr/bin/env bash
set -euo pipefail
STAMP=$(date +%Y%m%d_%H%M%S)
DEST=/var/backups/mantra
mkdir -p "$DEST"
docker compose -f /opt/mantra/docker-compose.yaml exec -T postgres \
  pg_dump -U mantra mantra | gzip > "$DEST/mantra_$STAMP.sql.gz"
# Keep 14 days
find "$DEST" -name "mantra_*.sql.gz" -mtime +14 -delete
```

```
# crontab -e
0 3 * * * /opt/mantra/scripts/backup.sh >> /var/log/mantra-backup.log 2>&1
```

**Off-box copy** (optional but recommended):

```bash
# Add to backup.sh if you have rclone configured for Google Drive or B2:
rclone copy "$DEST/mantra_$STAMP.sql.gz" remote:mantra-backups/
```

---

## When you migrate to multi-tenant / public later

These are the only things that change:

1. Buy domain, point DNS to VPS public IP.
2. In Coolify: assign domain to frontend + backend services → Coolify requests
   Let's Encrypt cert automatically.
3. UFW: `sudo ufw allow 80,443/tcp`.
4. Backend env: `PUBLIC_BACKEND_URL=https://api.yourdomain.com`,
   `FRONTEND_URL=https://app.yourdomain.com`.
5. Frontend env: `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`.
6. Re-deploy. Coolify rolls over.

No code changes needed. The app was built to support both topologies.
