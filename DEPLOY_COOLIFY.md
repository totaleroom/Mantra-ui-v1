# 🚀 Deploy Mantra AI ke VPS Debian 12 + Coolify

Panduan **lengkap dari nol** untuk deploy Mantra AI (frontend + backend + postgres + redis + evolution) ke VPS Anda pakai Coolify. Semua dalam 1 mesin, database **self-hosted**.

---

## 📋 Prasyarat

### Yang Anda butuhkan:

| Item | Spesifikasi | Estimasi Biaya |
|------|-------------|----------------|
| **VPS Debian 12** | 4 GB RAM, 2 vCPU, 40 GB SSD | Rp 80k–150k/bulan |
| **Domain** | 1 domain utama (e.g. `mantra.yourdomain.com`) | Rp 150k/tahun |
| **GitHub account** | Untuk push kode | Gratis |
| **Waktu setup** | ~60 menit | — |

### Rekomendasi VPS:
- **Hetzner CPX21** (€5.8/bulan, lokasi Singapore) — paling worth it
- **Contabo Cloud VPS S** (€5.5/bulan, Singapore)
- **BiznetGio** (Rp 150k/bulan, Jakarta — lokal Indonesia)
- **DigitalOcean Droplet** ($12/month, Singapore)

---

## 🎯 Arsitektur Akhir

```
Internet
  │
  └─→ [VPS Debian 12 - 4GB RAM]
         │
         ├─ Coolify (reverse proxy + SSL otomatis)
         │   │
         │   ├─→ mantra.yourdomain.com    → frontend:5000 (Next.js)
         │   ├─→ api.yourdomain.com       → backend:3001  (Go Fiber)
         │   └─→ evo.yourdomain.com       → evolution:8080 (WhatsApp)
         │
         └─ Internal Docker Network (tidak expose ke internet)
             ├─ postgres:5432
             └─ redis:6379
```

**Keuntungan arsitektur ini:**
- ✅ Database & Redis hanya accessible dari internal network → aman dari attack
- ✅ Coolify auto-setup SSL via Let's Encrypt
- ✅ Semua di 1 docker network → cookie same-domain, no CORS issue
- ✅ Backup database tinggal `pg_dump` di server

---

## 📝 Langkah 1: Setup VPS Debian 12

### 1.1. SSH ke VPS & update sistem

```bash
ssh root@YOUR_VPS_IP
apt update && apt upgrade -y
apt install -y curl wget git ufw
```

### 1.2. Setup firewall

```bash
ufw allow OpenSSH
ufw allow 80/tcp      # HTTP (Let's Encrypt)
ufw allow 443/tcp     # HTTPS
ufw allow 8000/tcp    # Coolify dashboard
ufw --force enable
ufw status
```

### 1.3. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
docker --version
```

### 1.4. Install Coolify (1 command)

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Tunggu ~5 menit. Setelah selesai, akses:
```
http://YOUR_VPS_IP:8000
```

Buat akun admin pertama (email + password kuat).

---

## 🌐 Langkah 2: Setup Domain (DNS)

Di DNS provider Anda (Cloudflare/Namecheap/dll), arahkan 3 subdomain ini ke VPS IP:

| Record Type | Name | Value |
|-------------|------|-------|
| A | `mantra` | `YOUR_VPS_IP` |
| A | `api` | `YOUR_VPS_IP` |
| A | `evo` | `YOUR_VPS_IP` |

**Tunggu 5–30 menit** untuk DNS propagation. Test:
```bash
dig mantra.yourdomain.com +short
# Harus return IP VPS Anda
```

---

## 📦 Langkah 3: Push Kode ke GitHub

### 3.1. Buat repository kosong di GitHub

- Login GitHub → "New repository" → nama: `mantra-ai` → **Private**

### 3.2. Push kode lokal ke GitHub

Dari folder project di laptop Anda:

```powershell
# Windows PowerShell
cd "c:\Users\RamadhYu\Downloads\Mantra-ui-v1 (1)\Mantra-ui-v1"
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/USERNAME/mantra-ai.git
git branch -M main
git push -u origin main
```

---

## 🚀 Langkah 4: Deploy via Coolify

### 4.1. Connect GitHub di Coolify

1. Buka `http://YOUR_VPS_IP:8000`
2. Menu kiri → **Sources** → "New" → GitHub App
3. Ikuti wizard install GitHub App, pilih repo `mantra-ai`

### 4.2. Buat Resource baru

1. **+ New Resource** → **Docker Compose**
2. Source: pilih GitHub → repo `mantra-ai` → branch `main`
3. Compose file: `docker-compose.yaml`
4. **Save** (jangan deploy dulu)

### 4.3. Set Environment Variables

Di tab **Environment Variables**, paste (ganti nilai bintang **WAJIB**):

```env
# === CRITICAL — ganti semua ini ===
POSTGRES_PASSWORD=GANTI_DENGAN_PASSWORD_KUAT_32_KARAKTER
JWT_SECRET=GANTI_DENGAN_64_CHAR_RANDOM_DARI_openssl_rand_base64_48
EVO_API_KEY=GANTI_DENGAN_RANDOM_32_CHAR
HERMES_AUTH_TOKEN=GANTI_DENGAN_RANDOM_32_CHAR

# === Domain Anda ===
FRONTEND_URL=https://mantra.yourdomain.com
NEXT_PUBLIC_BASE_URL=https://mantra.yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com
NEXT_PUBLIC_BACKEND_URL=https://api.yourdomain.com
NEXT_PUBLIC_EVO_URL=https://evo.yourdomain.com
EVOLUTION_SERVER_URL=https://evo.yourdomain.com

# === Standar (jangan ubah kecuali tahu) ===
POSTGRES_USER=mantra
POSTGRES_DB=mantra_db
EVO_INSTANCE_NAME=mantra_instance
NEXT_PUBLIC_EVO_INSTANCE_NAME=mantra_instance
APP_ENV=production
NODE_ENV=production
```

**Cara generate secret:**
```bash
# Di terminal VPS atau laptop
openssl rand -base64 48     # untuk JWT_SECRET
openssl rand -hex 16        # untuk POSTGRES_PASSWORD, EVO_API_KEY, HERMES_AUTH_TOKEN
```

**⚡ Cara PALING CEPAT (recommended sejak Phase B)** — satu perintah
meng-generate SEMUA secret sekaligus, dan mencetak isi `.env` yang
tinggal Anda paste ke Coolify:

```bash
# Di laptop/terminal mana pun yang punya openssl + bash
./scripts/generate-env.sh --public-url=https://mantra.yourdomain.com
```

Atau tulis langsung ke file `.env` lokal (berguna untuk test Docker
Compose offline sebelum push ke Coolify):

```bash
./scripts/generate-env.sh --public-url=https://mantra.yourdomain.com --write
```

Script akan auto-backup `.env.backup.<timestamp>` kalau file `.env`
lama sudah ada, dan akan generate:
`JWT_SECRET`, `WEBHOOK_SECRET`, `POSTGRES_PASSWORD`,
`HERMES_AUTH_TOKEN`, dan `EVO_API_KEY` (atau pakai `--evo-key=XXX`
kalau Anda punya Evolution external yang sudah jalan).

### 4.4. Map Domain ke Container

Di tab **Domains**, tambahkan mapping:

| Service | Domain | Port |
|---------|--------|------|
| `frontend` | `https://mantra.yourdomain.com` | 5000 |
| `backend` | `https://api.yourdomain.com` | 3001 |
| `evolution` | `https://evo.yourdomain.com` | 8080 |

Coolify akan auto-setup **SSL via Let's Encrypt** untuk semua domain.

### 4.5. Deploy!

Klik tombol **Deploy** di kanan atas.

Tunggu ~5–10 menit untuk:
- Build frontend Docker image
- Build backend Docker image
- Pull postgres, redis, evolution images
- Start containers
- Healthcheck semua service

---

## ✅ Langkah 5: Verifikasi Deploy

### 5.1. Cek status semua container di Coolify

Semua harus **green (healthy)**:
- ✅ mantra_postgres
- ✅ mantra_redis
- ✅ mantra_evolution
- ✅ mantra_backend
- ✅ mantra_frontend

### 5.2. Test endpoints via browser

1. **Frontend**: `https://mantra.yourdomain.com/login` → harus muncul halaman login
2. **Backend health**: `https://api.yourdomain.com/health` → harus return `{"status":"ok"}`
3. **Evolution**: `https://evo.yourdomain.com` → halaman login Evolution

### 5.3. Login pertama kali

Buka `https://mantra.yourdomain.com/login`:
```
Email:    admin@mantra.ai
Password: MantraAdmin2024!
```

**Sejak Phase B**, aplikasi akan **otomatis redirect ke
`/change-password`** — Anda WAJIB ganti password dulu sebelum bisa
akses dashboard. Ini by design: default password hanya dipakai satu
kali, lalu dirotasi. Hal yang sama berlaku untuk akun `demo@mantra.ai`.

Setelah rotasi sukses, Anda akan otomatis masuk ke dashboard utama.

---

## 🔒 Langkah 6: Harden Security (WAJIB)

### 6.1. Ganti password admin

```bash
# SSH ke VPS
docker exec -it mantra_postgres psql -U mantra -d mantra_db
```

Lalu di prompt psql:
```sql
-- Generate bcrypt hash baru di https://bcrypt.online (cost 10)
UPDATE users 
SET password = '$2a$10$HASH_BARU_ANDA' 
WHERE email = 'admin@mantra.ai';
\q
```

### 6.2. Disable seed user demo (opsional)

```sql
DELETE FROM users WHERE email = 'demo@mantra.ai';
```

### 6.3. Update `DEV_AUTH_BYPASS` (WAJIB!)

Di Coolify env vars, pastikan **TIDAK ADA** `DEV_AUTH_BYPASS=true` di production. Jika ada, hapus. Mode bypass ini **hanya untuk development**.

---

## 🔄 Langkah 7: Auto-Deploy (CI/CD)

Di Coolify:
1. Buka project → **Settings** → **Webhooks**
2. Enable **"Deploy on push"**
3. Setiap Anda `git push` ke `main`, Coolify otomatis re-deploy

---

## 💾 Backup Database

### Manual backup
```bash
# Di VPS
docker exec mantra_postgres pg_dump -U mantra mantra_db > backup_$(date +%Y%m%d).sql
```

### Automated backup via cron
```bash
# crontab -e
0 2 * * * docker exec mantra_postgres pg_dump -U mantra mantra_db | gzip > /root/backups/mantra_$(date +\%Y\%m\%d).sql.gz
```

Restore:
```bash
docker exec -i mantra_postgres psql -U mantra mantra_db < backup_20261201.sql
```

---

## 🐛 Troubleshooting

### Frontend blank / 502 error

```bash
# Cek logs
docker logs mantra_frontend --tail 100

# Cek env vars ke-build-in
docker exec mantra_frontend printenv | grep NEXT_PUBLIC
```

Jika `NEXT_PUBLIC_API_URL` masih `localhost`, **rebuild** dari Coolify (bukan restart).

### Backend error "Database not connected"

```bash
docker logs mantra_backend --tail 50
docker exec mantra_postgres pg_isready -U mantra
```

### Login gagal "Invalid credentials"

```bash
# Cek user ada di DB
docker exec -it mantra_postgres psql -U mantra -d mantra_db -c "SELECT email, role FROM users;"
```

Jika kosong, init.sql tidak jalan — hapus volume `postgres_data` dan re-deploy:
```bash
docker compose down
docker volume rm mantra-ai_postgres_data
docker compose up -d
```

### CORS error di browser console

Pastikan `FRONTEND_URL` di env var **persis sama** dengan URL yang dipakai user (termasuk `https://` dan tidak ada trailing slash).

---

## 📊 Monitoring

### Real-time logs
```bash
docker compose logs -f
# Atau per service
docker logs -f mantra_backend
```

### Resource usage
```bash
docker stats
```

### Disk usage
```bash
du -sh /var/lib/docker/volumes/*
```

---

## 🔧 Update ke versi baru

Tinggal push kode baru ke GitHub:
```powershell
git add .
git commit -m "Update fitur X"
git push
```

Coolify auto-deploy (jika webhook sudah diaktifkan).

---

## 📞 Checklist Final

Sebelum go-live, pastikan:

- [ ] Password admin sudah diganti dari default
- [ ] User `demo@mantra.ai` sudah dihapus (atau password diganti)
- [ ] `DEV_AUTH_BYPASS` **tidak ada** di env production
- [ ] Semua `JWT_SECRET`, `POSTGRES_PASSWORD`, `EVO_API_KEY` adalah random 32+ char
- [ ] SSL aktif (ada 🔒 di browser) untuk semua 3 domain
- [ ] Backup cron aktif
- [ ] Firewall hanya buka port 22, 80, 443, 8000
- [ ] Coolify dashboard pakai password kuat + 2FA kalau bisa

---

**Butuh bantuan?** Buka issue di repo GitHub atau ping saya. Selamat deploy! 🚀
