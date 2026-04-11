# Mantra AI - Deployment Guide for Debian VPS

> **Target:** Debian 12 (Bookworm) VPS  
> **Stack:** Docker, Go Fiber, PostgreSQL, Redis, Evolution API  
> **Tunnel:** Cloudflare Zero Trust

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Setup](#server-setup)
3. [Docker Installation](#docker-installation)
4. [Directory Structure](#directory-structure)
5. [Docker Compose Configuration](#docker-compose-configuration)
6. [Environment Configuration](#environment-configuration)
7. [Cloudflare Tunnel Setup](#cloudflare-tunnel-setup)
8. [Database Migration](#database-migration)
9. [Deployment Commands](#deployment-commands)
10. [Health Checks & Monitoring](#health-checks--monitoring)
11. [Backup Strategy](#backup-strategy)
12. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- Debian 12 VPS with root access (minimum 2GB RAM, 2 vCPU)
- Domain name configured in Cloudflare
- Cloudflare Zero Trust account
- Evolution API license (if using premium features)

---

## Server Setup

### 1. Update System

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git htop vim ufw
```

### 2. Configure Firewall

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS (for Cloudflare Tunnel)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
sudo ufw status
```

### 3. Create Dedicated User

```bash
sudo useradd -m -s /bin/bash mantra
sudo usermod -aG sudo mantra
sudo passwd mantra
```

---

## Docker Installation

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Add user to docker group
sudo usermod -aG docker mantra

# Install Docker Compose
sudo apt install -y docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

---

## Directory Structure

```bash
sudo mkdir -p /opt/mantra
sudo chown mantra:mantra /opt/mantra
cd /opt/mantra

# Create directories
mkdir -p {api,evolution,postgres,redis,nginx,cloudflared,backups}
mkdir -p postgres/data redis/data evolution/instances
```

Final structure:
```
/opt/mantra/
├── docker-compose.yml
├── .env
├── api/
│   └── Dockerfile
├── evolution/
│   └── instances/
├── postgres/
│   ├── data/
│   └── init/
├── redis/
│   └── data/
├── cloudflared/
│   └── config.yml
└── backups/
```

---

## Docker Compose Configuration

Create `/opt/mantra/docker-compose.yml`:

```yaml
version: '3.9'

services:
  # ==========================================
  # PostgreSQL Database
  # ==========================================
  postgres:
    image: postgres:16-alpine
    container_name: mantra-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - ./postgres/data:/var/lib/postgresql/data
      - ./postgres/init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - mantra-network

  # ==========================================
  # Redis Cache
  # ==========================================
  redis:
    image: redis:7-alpine
    container_name: mantra-redis
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
    volumes:
      - ./redis/data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - mantra-network

  # ==========================================
  # Evolution API (WhatsApp)
  # ==========================================
  evolution:
    image: atendai/evolution-api:latest
    container_name: mantra-evolution
    restart: unless-stopped
    environment:
      SERVER_URL: ${EVOLUTION_SERVER_URL}
      AUTHENTICATION_API_KEY: ${EVOLUTION_API_KEY}
      AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES: "true"
      DATABASE_ENABLED: "true"
      DATABASE_PROVIDER: postgresql
      DATABASE_CONNECTION_URI: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      DATABASE_SAVE_DATA_INSTANCE: "true"
      DATABASE_SAVE_DATA_NEW_MESSAGE: "true"
      DATABASE_SAVE_MESSAGE_UPDATE: "true"
      DATABASE_SAVE_DATA_CONTACTS: "true"
      DATABASE_SAVE_DATA_CHATS: "true"
      REDIS_ENABLED: "true"
      REDIS_URI: redis://:${REDIS_PASSWORD}@redis:6379
      REDIS_PREFIX_KEY: evolution
      WEBHOOK_GLOBAL_URL: ${WEBHOOK_GLOBAL_URL}
      WEBHOOK_GLOBAL_ENABLED: "true"
      WEBHOOK_EVENTS_APPLICATION_STARTUP: "true"
      WEBHOOK_EVENTS_QRCODE_UPDATED: "true"
      WEBHOOK_EVENTS_MESSAGES_SET: "true"
      WEBHOOK_EVENTS_MESSAGES_UPSERT: "true"
      WEBHOOK_EVENTS_CONNECTION_UPDATE: "true"
      CORS_ORIGIN: "*"
      CORS_METHODS: "GET,POST,PUT,DELETE"
      CORS_CREDENTIALS: "true"
    volumes:
      - ./evolution/instances:/evolution/instances
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - mantra-network

  # ==========================================
  # Mantra API (Go Fiber)
  # ==========================================
  api:
    build:
      context: ./api
      dockerfile: Dockerfile
    container_name: mantra-api
    restart: unless-stopped
    environment:
      APP_ENV: production
      APP_PORT: 3001
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?sslmode=disable
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      JWT_SECRET: ${JWT_SECRET}
      EVOLUTION_API_URL: http://evolution:8080
      EVOLUTION_API_KEY: ${EVOLUTION_API_KEY}
      CORS_ORIGINS: ${CORS_ORIGINS}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      evolution:
        condition: service_started
    networks:
      - mantra-network

  # ==========================================
  # Cloudflare Tunnel
  # ==========================================
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: mantra-cloudflared
    restart: unless-stopped
    command: tunnel --config /etc/cloudflared/config.yml run
    volumes:
      - ./cloudflared:/etc/cloudflared
    depends_on:
      - api
    networks:
      - mantra-network

networks:
  mantra-network:
    driver: bridge
```

---

## Environment Configuration

Create `/opt/mantra/.env`:

```bash
# ==========================================
# Database
# ==========================================
POSTGRES_USER=mantra_user
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=mantra_db

# ==========================================
# Redis
# ==========================================
REDIS_PASSWORD=your_redis_password_here

# ==========================================
# JWT Authentication
# ==========================================
JWT_SECRET=your_256_bit_secret_key_here

# ==========================================
# Evolution API
# ==========================================
EVOLUTION_API_KEY=your_evolution_api_key
EVOLUTION_SERVER_URL=https://api.yourdomain.com

# ==========================================
# Webhooks
# ==========================================
WEBHOOK_GLOBAL_URL=http://api:3001/webhooks/evolution

# ==========================================
# CORS (Vercel Frontend URL)
# ==========================================
CORS_ORIGINS=https://your-app.vercel.app,http://localhost:3000
```

Generate secure secrets:

```bash
# Generate JWT secret
openssl rand -base64 32

# Generate passwords
openssl rand -base64 24
```

---

## Cloudflare Tunnel Setup

### 1. Install cloudflared locally

```bash
# On your local machine or the server
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/
```

### 2. Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

### 3. Create Tunnel

```bash
cloudflared tunnel create mantra-api
```

This creates a credentials file at `~/.cloudflared/<TUNNEL_ID>.json`

### 4. Copy credentials to server

```bash
cp ~/.cloudflared/<TUNNEL_ID>.json /opt/mantra/cloudflared/credentials.json
```

### 5. Create tunnel config

Create `/opt/mantra/cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /etc/cloudflared/credentials.json

ingress:
  # Main API
  - hostname: api.yourdomain.com
    service: http://api:3001
    originRequest:
      connectTimeout: 30s
      noTLSVerify: false

  # Evolution API (optional direct access)
  - hostname: evolution.yourdomain.com
    service: http://evolution:8080
    originRequest:
      connectTimeout: 30s

  # Catch-all
  - service: http_status:404
```

### 6. Configure DNS in Cloudflare

```bash
cloudflared tunnel route dns mantra-api api.yourdomain.com
cloudflared tunnel route dns mantra-api evolution.yourdomain.com
```

---

## Database Migration

### 1. Create init script

Create `/opt/mantra/postgres/init/001_schema.sql`:

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'STAFF',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    token_balance INTEGER DEFAULT 0,
    token_limit INTEGER DEFAULT 1000,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- AI Providers table
CREATE TABLE IF NOT EXISTS ai_providers (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    provider_name VARCHAR(100) NOT NULL,
    api_key VARCHAR(500) NOT NULL,
    base_url VARCHAR(500),
    priority INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    last_error TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Client AI Configs table
CREATE TABLE IF NOT EXISTS client_ai_configs (
    id SERIAL PRIMARY KEY,
    client_id INTEGER UNIQUE REFERENCES clients(id) ON DELETE CASCADE,
    model_id VARCHAR(100) NOT NULL,
    system_prompt TEXT NOT NULL,
    vector_namespace VARCHAR(100),
    temperature DECIMAL(3,2) DEFAULT 0.7,
    memory_ttl_days INTEGER DEFAULT 4,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- WhatsApp Instances table
CREATE TABLE IF NOT EXISTS whatsapp_instances (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    instance_name VARCHAR(100) UNIQUE NOT NULL,
    instance_api_key VARCHAR(500),
    webhook_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'DISCONNECTED',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer Memories table
CREATE TABLE IF NOT EXISTS customer_memories (
    id SERIAL PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    customer_number VARCHAR(50) NOT NULL,
    summary TEXT,
    raw_history JSONB,
    expires_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System Diagnosis table
CREATE TABLE IF NOT EXISTS system_diagnosis (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,
    latency INTEGER NOT NULL,
    last_check TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages table (for inbox)
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(50) PRIMARY KEY,
    client_id INTEGER REFERENCES clients(id) ON DELETE CASCADE,
    customer_number VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    direction VARCHAR(10) NOT NULL,
    ai_thought_process TEXT,
    model_used VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_messages_client_id ON messages(client_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_customer_memories_expires ON customer_memories(expires_at);
CREATE INDEX idx_ai_providers_priority ON ai_providers(priority);
```

---

## Deployment Commands

### Initial Deployment

```bash
cd /opt/mantra

# Pull images
docker compose pull

# Build API (if using custom Dockerfile)
docker compose build api

# Start all services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

### Update Deployment

```bash
cd /opt/mantra

# Pull latest images
docker compose pull

# Rebuild API if needed
docker compose build api --no-cache

# Restart services
docker compose up -d --force-recreate

# Clean up old images
docker image prune -f
```

### Useful Commands

```bash
# View specific service logs
docker compose logs -f api
docker compose logs -f evolution

# Enter container shell
docker compose exec api sh
docker compose exec postgres psql -U mantra_user -d mantra_db

# Restart single service
docker compose restart api

# Stop all services
docker compose down

# Stop and remove volumes (CAUTION: data loss)
docker compose down -v
```

---

## Health Checks & Monitoring

### API Health Endpoint

```bash
curl https://api.yourdomain.com/health
```

Expected response:
```json
{
  "status": "ok",
  "services": {
    "postgres": "healthy",
    "redis": "healthy",
    "evolution": "healthy"
  }
}
```

### Monitoring Script

Create `/opt/mantra/scripts/health-check.sh`:

```bash
#!/bin/bash

API_URL="https://api.yourdomain.com/health"
SLACK_WEBHOOK="your_slack_webhook_url"

response=$(curl -s -o /dev/null -w "%{http_code}" $API_URL)

if [ $response -ne 200 ]; then
  curl -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"ALERT: Mantra API is down! HTTP $response\"}" \
    $SLACK_WEBHOOK
fi
```

Add to crontab:
```bash
*/5 * * * * /opt/mantra/scripts/health-check.sh
```

---

## Backup Strategy

### Automated Database Backup

Create `/opt/mantra/scripts/backup.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/opt/mantra/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Backup PostgreSQL
docker compose exec -T postgres pg_dump -U mantra_user mantra_db > $BACKUP_DIR/db_$DATE.sql

# Compress
gzip $BACKUP_DIR/db_$DATE.sql

# Remove old backups
find $BACKUP_DIR -name "db_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: db_$DATE.sql.gz"
```

Add to crontab (daily at 2 AM):
```bash
0 2 * * * /opt/mantra/scripts/backup.sh
```

---

## Troubleshooting

### Common Issues

**1. Connection refused to API**
```bash
# Check if containers are running
docker compose ps

# Check API logs
docker compose logs api --tail 100

# Verify network
docker network inspect mantra_mantra-network
```

**2. Evolution API not connecting**
```bash
# Check Evolution logs
docker compose logs evolution --tail 100

# Verify webhook URL
curl -X POST http://localhost:8080/webhook/test
```

**3. Database connection issues**
```bash
# Test PostgreSQL connection
docker compose exec postgres pg_isready

# Check connection string
docker compose exec api env | grep DATABASE
```

**4. WebSocket not working**
```bash
# Ensure Cloudflare proxy settings allow WebSocket
# In Cloudflare Dashboard: SSL/TLS > Edge Certificates > Enable WebSockets
```

**5. High memory usage**
```bash
# Check container stats
docker stats

# Limit container memory in docker-compose.yml:
# deploy:
#   resources:
#     limits:
#       memory: 512M
```

---

## Security Checklist

- [ ] Change all default passwords
- [ ] Enable UFW firewall
- [ ] Configure fail2ban for SSH
- [ ] Use Cloudflare Tunnel (no exposed ports)
- [ ] Enable PostgreSQL SSL
- [ ] Rotate JWT secrets periodically
- [ ] Enable audit logging
- [ ] Set up automated backups
- [ ] Configure rate limiting in API
- [ ] Review CORS origins

---

## Contact

For issues with this deployment, contact the Mantra AI team.
