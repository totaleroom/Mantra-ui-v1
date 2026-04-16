# Mantra AI — Development Reference

> **Dokumen ini hanya untuk keperluan development.**
> Jangan commit ke repository publik atau share ke production environment.

---

## Login Credentials (Development)

### Super Admin
| Field    | Value                  |
|----------|------------------------|
| Email    | `admin@mantra.ai`      |
| Password | `MantraAdmin2024!`     |
| Role     | `SUPER_ADMIN`          |
| Akses    | Semua halaman (termasuk `/diagnosis` dan `/settings`) |

### Client Admin (Demo)
| Field    | Value                  |
|----------|------------------------|
| Email    | `demo@mantra.ai`       |
| Password | `admin123`             |
| Role     | `CLIENT_ADMIN`         |
| Akses    | Dashboard, Inbox, WhatsApp, AI Hub, Tenants (tidak bisa akses `/diagnosis` dan `/settings`) |

---

## Role-Based Access Control (RBAC)

| Route         | SUPER_ADMIN | CLIENT_ADMIN | STAFF |
|---------------|-------------|--------------|-------|
| `/`           | ✅          | ✅           | ✅    |
| `/inbox`      | ✅          | ✅           | ✅    |
| `/whatsapp`   | ✅          | ✅           | ✅    |
| `/ai-hub`     | ✅          | ✅           | ✅    |
| `/tenants`    | ✅          | ✅           | ✅    |
| `/settings`   | ✅          | ❌           | ❌    |
| `/diagnosis`  | ✅          | ❌           | ❌    |

---

## URLs

| Service       | URL (Development)                    | Port  |
|---------------|--------------------------------------|-------|
| Frontend      | `http://localhost:5000`              | 5000  |
| Backend API   | `http://localhost:3001`              | 3001  |
| Login Page    | `http://localhost:5000/login`        | —     |
| Health Check  | `http://localhost:3001/health`       | —     |

---

## Database (Replit Dev)

| Field         | Value                                                           |
|---------------|-----------------------------------------------------------------|
| Connection    | `postgresql://postgres:password@helium/heliumdb?sslmode=disable` |
| Host          | `helium`                                                        |
| Database      | `heliumdb`                                                      |
| User          | `postgres`                                                      |
| Password      | `password`                                                      |

### Tables yang Ada
- `users` — akun login
- `clients` — tenant/klien
- `ai_providers` — konfigurasi AI (Groq, OpenRouter, OpenAI)
- `whatsapp_instances` — instance WhatsApp
- `inbox_messages` — pesan masuk/keluar
- `customer_memories` — memori pelanggan (Redis + Postgres, TTL 4 hari)
- `system_diagnoses` — status sistem
- `client_ai_configs` — konfigurasi AI per klien

### Query Berguna

```sql
-- Lihat semua user
SELECT id, email, role, created_at FROM users;

-- Reset password admin (hash dari "MantraAdmin2024!")
UPDATE users SET password = '$2a$10$GNm/LleSefP5IS3.mbmNWuiHGOZGKTnDdEKrtdu/KBoZk.VO0XIby'
WHERE email = 'admin@mantra.ai';

-- Tambah user baru (generate hash dulu via backend)
-- POST /api/auth/register { "email": "...", "password": "...", "role": "CLIENT_ADMIN" }
```

---

## Backend API

Base URL: `http://localhost:3001`

### Authentication
| Method | Endpoint              | Body                          | Keterangan           |
|--------|-----------------------|-------------------------------|----------------------|
| POST   | `/api/auth/login`     | `{ email, password }`         | Login, set cookie    |
| POST   | `/api/auth/logout`    | —                             | Clear cookie         |
| GET    | `/api/auth/me`        | —                             | Info user yang login |

### Quick Test Login (curl)
```bash
curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mantra.ai","password":"MantraAdmin2024!"}' | jq .
```

### Health Check
```bash
curl http://localhost:3001/health
```

Expected response (production):
```json
{ "status": "ok", "db": "connected", "redis": "connected" }
```

Expected response (dev, tanpa Redis):
```json
{ "status": "degraded", "db": "connected", "redis": "unavailable" }
```

---

## Environment Variables (Dev)

File: `.env` (copy dari `.env.example`)

```env
# Backend
PORT=3001
APP_ENV=development
JWT_SECRET=change-me-in-production-please
DATABASE_URL=postgresql://postgres:password@helium/heliumdb?sslmode=disable
REDIS_URL=redis://localhost:6379

# Evolution API (isi jika sudah punya VPS)
EVO_API_URL=https://vps-anda.com
EVO_API_KEY=your-api-key
EVO_INSTANCE_NAME=mantra_instance

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
```

---

## Auth Flow

```
User buka /inbox (belum login)
  → middleware redirect ke /login?redirect=/inbox

User submit form login
  → Server Action → POST /api/auth/login (Go backend)
  → Backend cek bcrypt, buat JWT, set cookie "mantra_session" (httpOnly, 24 jam)
  → Redirect ke /inbox

Request berikutnya
  → middleware verifikasi JWT dengan jose + JWT_SECRET
  → Cek role untuk route terbatas
  → Inject x-user-role header
```

---

## Cara Jalankan (Development)

```bash
# Terminal 1 — Backend
cd backend && go run .

# Terminal 2 — Frontend
pnpm run dev
```

Atau pakai workflow di Replit:
- **Start Backend** → Go Fiber di port 3001
- **Start application** → Next.js di port 5000

---

## Docker (Production)

```bash
# Build dan jalankan semua service
cp .env.example .env
# Edit .env dengan nilai production
docker compose up -d

# Cek status
docker compose ps
docker compose logs backend -f
```

Wajib diisi di `.env` sebelum deploy:
- `POSTGRES_PASSWORD`
- `JWT_SECRET` (minimal 64 karakter, gunakan `openssl rand -base64 48`)
- `FRONTEND_URL`
- `EVO_API_KEY`
- `HERMES_AUTH_TOKEN`
