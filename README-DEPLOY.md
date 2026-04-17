# 🚀 Mantra AI — Production Deployment Guide

> **Quick deploy your WhatsApp AI automation platform to a VPS**

---

## Prerequisites

- VPS with 2GB+ RAM (Debian/Ubuntu recommended)
- Docker & Docker Compose installed
- Domain name (optional but recommended)
- Evolution API key (get from [Evolution API](https://evolution-api.com/))

---

## ⚡ Quick Deploy (5 Minutes)

### Step 1: Upload to VPS

```bash
# On your local machine, compress and upload:
cd "Mantra-ui-v1 (1)"
zip -r mantra-deploy.zip Mantra-ui-v1 -x "*.git*" -x "node_modules/*" -x ".next/*" -x ".local/*"

# Upload to VPS (replace with your VPS IP)
scp mantra-deploy.zip root@YOUR_VPS_IP:/opt/
```

### Step 2: Extract on VPS

```bash
ssh root@YOUR_VPS_IP
cd /opt
unzip mantra-deploy.zip
mv Mantra-ui-v1 mantra
cd mantra
```

### Step 3: Configure Environment

```bash
# Copy production template
cp PRODUCTION.env.template .env

# Edit with your values
nano .env
```

**Required changes in `.env`:**

```env
# Your domain or IP
VPS_IP_OR_DOMAIN=https://api.yourdomain.com  # or http://43.157.223.29 for IP
FRONTEND_DOMAIN=https://app.yourdomain.com

# Generate strong secrets
JWT_SECRET=$(openssl rand -base64 48)
POSTGRES_PASSWORD=$(openssl rand -base64 24)
HERMES_AUTH_TOKEN=$(openssl rand -base64 32)

# Evolution API key (get from dashboard)
EVO_API_KEY=your-actual-evolution-api-key

# AI Provider keys (at least one)
OPENAI_API_KEY=sk-your-openai-key
# or GROQ_API_KEY=gsk-your-groq-key
# or OPENROUTER_API_KEY=sk-or-your-openrouter-key
```

### Step 4: Deploy

```bash
# Make script executable and run
chmod +x DEPLOY_LIVE.sh
./DEPLOY_LIVE.sh
```

This will:
1. ✅ Validate your environment variables
2. ✅ Build all Docker images
3. ✅ Start PostgreSQL, Redis, Evolution API, Backend, Frontend
4. ✅ Wait for health checks
5. ✅ Initialize database
6. ✅ Show deployment status

---

## 🔧 Manual Deploy (Alternative)

If you prefer manual control:

```bash
# 1. Build
docker compose build --no-cache

# 2. Start
docker compose up -d

# 3. Check status
docker compose ps

# 4. View logs
docker compose logs -f
```

---

## 🌐 Access Your App

After successful deployment:

| Service | URL | Notes |
|---------|-----|-------|
| **Frontend** | `http://YOUR_VPS_IP:5000` | Main dashboard |
| **Backend API** | `http://YOUR_VPS_IP:3001` | API endpoints |
| **Health Check** | `http://YOUR_VPS_IP:3001/health` | System status |
| **Evolution API** | `http://YOUR_VPS_IP:8080` | WhatsApp gateway |

### Default Login (Change immediately!)
- **Email:** `admin@mantra.ai`
- **Password:** `MantraAdmin2024!`

---

## 🛡️ Production Hardening

### 1. Use HTTPS (Cloudflare Tunnel Recommended)

```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create mantra-production

# Route DNS
cloudflared tunnel route dns mantra-production api.yourdomain.com
cloudflared tunnel route dns mantra-production app.yourdomain.com
```

### 2. Firewall Setup

```bash
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP (for Cloudflare)
ufw allow 443/tcp     # HTTPS (for Cloudflare)
ufw enable
```

### 3. Change Default Passwords

1. Login to dashboard
2. Go to Settings
3. Change admin password immediately

---

## 📊 Monitoring

### Check Service Health

```bash
# All services
docker compose ps

# Backend health
curl http://localhost:3001/health

# Logs
docker compose logs -f backend
docker compose logs -f evolution
docker compose logs -f frontend
```

### Resource Usage

```bash
# Container stats
docker stats

# System resources
htop
```

---

## 🔄 Updates

### Update to Latest Version

```bash
cd /opt/mantra

# Pull latest images
docker compose pull

# Rebuild with latest code
docker compose build --no-cache

# Restart
docker compose up -d --force-recreate

# Cleanup
docker image prune -f
```

---

## 🆘 Troubleshooting

### Services Won't Start

```bash
# Check logs for errors
docker compose logs --tail 100

# Verify environment
docker compose config  # Validates docker-compose.yaml

# Check disk space
df -h
```

### Database Connection Failed

```bash
# Check PostgreSQL is running
docker compose exec postgres pg_isready

# View PostgreSQL logs
docker compose logs postgres --tail 50

# Reset database (WARNING: DATA LOSS)
docker compose down -v
docker compose up -d
```

### Can't Access Frontend

```bash
# Check if frontend is running
docker compose exec frontend wget -qO- http://localhost:5000/login

# Check backend connectivity
docker compose exec frontend wget -qO- http://backend:3001/health
```

### Evolution API Issues

```bash
# Check Evolution status
docker compose logs evolution --tail 50

# Verify webhook is accessible
curl -X POST http://localhost:8080/webhook/test
```

---

## 📁 File Structure on VPS

```
/opt/mantra/
├── docker-compose.yaml      # Main orchestration
├── .env                     # Environment variables (NEVER SHARE)
├── Dockerfile               # Frontend build
├── DEPLOY_LIVE.sh           # Automated deployment
├── PRODUCTION.env.template  # Template for .env
├── backend/                 # Go backend code
│   ├── Dockerfile
│   └── database/
│       └── init.sql         # Database schema
├── components/              # React components
├── app/                     # Next.js app router
├── lib/                     # Shared utilities
│   ├── config.ts           # Environment config
│   └── env.ts              # Zod validation
└── ...
```

---

## 🎯 Next Steps After Deploy

1. **Configure WhatsApp**
   - Go to `/whatsapp` in dashboard
   - Create instance
   - Scan QR code with WhatsApp mobile

2. **Set Up AI Provider**
   - Go to `/ai-hub`
   - Add OpenAI/Groq/OpenRouter API key
   - Configure fallback chain

3. **Create Tenants**
   - Go to `/tenants`
   - Add new client
   - Configure AI persona

4. **Monitor Inbox**
   - Go to `/inbox`
   - Real-time messages appear here
   - AI responses are automated

---

## 🔐 Security Checklist

- [ ] Changed default admin password
- [ ] Using HTTPS (not HTTP) in production
- [ ] JWT_SECRET is 64+ random characters
- [ ] POSTGRES_PASSWORD is strong
- [ ] Firewall enabled (UFW)
- [ ] SSH key-based auth (no password)
- [ ] Regular backups configured
- [ ] Evolution API key is secured
- [ ] AI provider keys are rotated periodically

---

## 📞 Support

- **Documentation**: See `ARCHITECTURE.md` for system details
- **Environment**: See `.env.example` for all variables
- **Deployment**: See `docs/deployment-guide.md` for advanced setup

---

**Made with ❤️ by Mantra AI Team**
