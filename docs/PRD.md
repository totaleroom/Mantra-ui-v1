# PRD: Mantra AI (Agentic SaaS Edition)

**Version:** 2.2 (Production Ready - Security Hardened)  
**Infrastructure:** Hybrid (Next.js | Go Fiber | PostgreSQL | Redis | Evolution API)  
**Deployment:** Docker Compose (VPS atau Local)  
**Core Mission:** Automasi Agentic Workflow untuk 50+ UMKM dengan WhatsApp Gateway.

---

## 🆕 Release Notes (April 2026)

### Security Hardening
- ✅ Credential centralization: All `process.env` → `serverConfig`
- ✅ Hardcoded IPs removed dari `docker-compose.yaml`
- ✅ `.env.example` reorganized dengan 6 grouped sections
- ✅ `.gitignore` updated dengan strict patterns
- ✅ Database seeding dengan environment checks

### Deployment Automation
- ✅ **DEPLOY_LIVE.sh** - One-command deployment
- ✅ **PRODUCTION.env.template** - Production environment template
- ✅ **README-DEPLOY.md** - 5-minute deployment guide
- ✅ **ARCHITECTURE.md** - Complete system documentation

---

## 1. Executive Summary

Mantra AI adalah platform Multi-tenant Agentic SaaS yang menghubungkan UMKM dengan AI Agent otonom melalui WhatsApp. Sistem ini fokus pada efisiensi biaya (multi-provider fallback), privasi (transient memory 4 hari), dan transparansi operasional melalui "Omniscient Inbox".

---

## 2. Tech Stack (The "Lean" Machine)

| Layer | Technology | Deployment | Port | RAM |
|-------|------------|------------|------|-----|
| **Frontend** | Next.js 16 + ShadcnUI + Tailwind | Docker | 5000 | 256MB |
| **Backend** | Go Fiber | Docker | 3001 | 256MB |
| **Database** | PostgreSQL 15 | Docker | 5432 | 512MB |
| **Cache** | Redis 7 | Docker | 6379 | 256MB |
| **WA Bridge** | Evolution API | Docker | 8080 | 1GB |
| **Total** | - | - | - | **~2.3GB** |

### Connectivity Options
- **Local:** Direct HTTP (localhost)
- **Production:** Cloudflare Tunnel (HTTPS) atau Reverse Proxy

---

## 3. Feature Matrix (MoSCoW)

### Must-Have (M) - ✅ Implemented
- **Multi-tenant Instance:** Isolasi data antar klien (1 VPS untuk 50+ klien)
- **AI Provider Fallback:** Rotasi otomatis antar Groq, OpenRouter, dan OpenAI
- **WhatsApp QR Scanner:** Integrasi langsung di dashboard untuk pairing device
- **RAG Isolation:** Setiap klien memiliki Knowledge Base sendiri
- **Credential Centralization:** Environment variables dengan Zod validation
- **Automated Deployment:** One-command deployment script

### Should-Have (S) - ✅ Implemented
- **Omniscient Inbox:** Dashboard pemantau chat aktif real-time via WebSocket
- **AI Thought Process:** Kolom logika berpikir AI sebelum menjawab
- **Token Billing & Limit:** Sistem kuota token per klien
- **Role-Based Access:** SUPER_ADMIN, CLIENT_ADMIN, STAFF

### Could-Have (C) - ✅ Implemented
- **Transient Memory (TTL 4 Days):** Memori auto-hapus setelah 4 hari
- **System Diagnosis:** Panel monitoring dengan saran perbaikan
- **Security Hardening:** XSS prevention, JWT validation, input sanitization

---

## 4. Core Business Logic (The Intelligence Hub)

### Memory Logic
Menggunakan Redis untuk menyimpan context chat. Data memiliki TTL (Time-To-Live) 4 hari. Sebelum AI menjawab, sistem akan melakukan summarization memori singkat untuk menghemat token.

### Fallback Logic
Jika Provider Utama (misal: Groq) mengembalikan error 429 atau 5xx, sistem otomatis berpindah ke Provider Cadangan (misal: OpenRouter) dalam waktu < 500ms.

### Deployment Logic
Frontend di Vercel memanggil Backend di VPS melalui API URL terenkripsi Cloudflare Tunnel.

---

## 5. Dashboard UI Guidelines (FinFlow Aesthetic)

### Design Philosophy
Mengadopsi aesthetic dari FinFlow Modern Finance template - clean, professional, dan sophisticated dengan fokus pada readability dan data density.

### Color Palette

#### Light Mode (Default)
| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `oklch(0.985 0 0)` | Page background - Off-white |
| `--card` | `oklch(1 0 0)` | Card surfaces - Pure white |
| `--primary` | `oklch(0.205 0 0)` | Primary actions - Near black |
| `--muted` | `oklch(0.97 0 0)` | Subtle backgrounds |
| `--border` | `oklch(0.922 0 0)` | Borders - Light gray |

#### Dark Mode (Preferred)
| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `oklch(0.145 0 0)` | Page background - Deep charcoal |
| `--card` | `oklch(0.175 0 0)` | Card surfaces - Elevated |
| `--primary` | `oklch(0.985 0 0)` | Primary actions - Off-white |
| `--muted` | `oklch(0.269 0 0)` | Subtle backgrounds |
| `--border` | `oklch(0.269 0 0)` | Borders - Subtle gray |

#### Status Colors (Semantic)
| Status | Light Mode | Dark Mode | Usage |
|--------|------------|-----------|-------|
| Success | `oklch(0.6 0.118 160)` | `oklch(0.696 0.17 162.48)` | Connected, Active |
| Warning | `oklch(0.75 0.15 85)` | `oklch(0.769 0.188 70.08)` | Pending, Attention |
| Error | `oklch(0.577 0.245 27.325)` | `oklch(0.645 0.246 16.439)` | Disconnected, Failed |
| Info | `oklch(0.6 0.118 240)` | `oklch(0.488 0.243 264.376)` | Information |

### Typography
- **Sans-serif:** Inter (clean, professional, highly legible)
- **Monospace:** JetBrains Mono (technical data, phone numbers, IDs)
- **Font Weights:** 400 (body), 500 (labels), 600 (headings), 700 (emphasis)

### Design Principles

1. **Neutral First**
   - Use grayscale as the primary palette
   - Color only for semantic meaning (status, alerts, actions)
   - Avoid decorative colors that don't convey information

2. **Subtle Elevation**
   - Use soft shadows instead of harsh borders
   - Card elevation creates visual hierarchy
   - `.shadow-soft` and `.shadow-soft-lg` utility classes

3. **Data Density**
   - Maximize information per screen
   - Compact but readable typography
   - Progressive disclosure for complex data

4. **Minimalist Interaction**
   - Hover states use subtle opacity/shadow changes
   - Focus states use ring outline
   - Transitions at 200ms for responsiveness

### Component Styling

#### Cards
```css
/* Clean card with subtle shadow */
.card {
  @apply bg-card border border-border rounded-lg shadow-soft;
}

/* Interactive card with hover effect */
.card-interactive {
  @apply transition-all duration-200 hover:shadow-soft-lg hover:border-primary/20;
}
```

#### Status Indicators
```css
/* Connected - Teal/Green tint */
.status-connected {
  @apply bg-success/10 text-success border border-success/20;
}

/* Disconnected - Red tint */
.status-disconnected {
  @apply bg-error/10 text-error border border-error/20;
}

/* Pending - Amber tint */
.status-connecting {
  @apply bg-warning/10 text-warning border border-warning/20;
}
```

#### Buttons
- **Primary:** Solid dark (light mode) / solid light (dark mode)
- **Secondary:** Subtle background with border
- **Ghost:** Transparent with hover background
- **Destructive:** Red accent, used sparingly

### Mobile-First Responsive
- **Sidebar:** Sheet/Drawer on mobile (<1024px)
- **Tables:** Card-stack view on mobile
- **Modals:** Full-screen on mobile, centered on desktop
- **Navigation:** Bottom sheet or hamburger menu

### Skeleton Loading
All data-fetching components must show skeleton states using ShadcnUI Skeleton component with matching dimensions.

### Notification Toasts
Every user action (Save, Delete, Connect, Error) must trigger a Sonner toast notification with appropriate styling.

---

## 6. Route Structure

| Route | Access | Description |
|-------|--------|-------------|
| `/` | All roles | Command Center overview |
| `/ai-hub` | Admin+ | AI Provider management |
| `/whatsapp` | Admin+ | WhatsApp instance management |
| `/inbox` | All roles | Omniscient message inbox |
| `/tenants` | Admin+ | Tenant list |
| `/tenants/[id]` | Admin+ | Tenant configuration |
| `/diagnosis` | SUPER_ADMIN | System health monitoring |
| `/settings` | SUPER_ADMIN | Global settings |

---

## 7. Deployment Strategy (Hermes Guide)

Setiap komponen dibungkus dalam Docker kontainer dengan limitasi RAM ketat:

| Service | RAM Limit | Notes |
|---------|-----------|-------|
| PostgreSQL | 512MB | Primary database |
| Redis | 256MB | Transient memory & queue |
| Evolution API | 1GB | WhatsApp bridge |
| Go Backend | 256MB | API server |

**Total Usable RAM:** ~2.5GB (Aman untuk VPS 4GB)

---

## 8. Changelog

### v2.1 (Current)
- **Aesthetic Overhaul:** Migrated from neon cyberpunk theme to FinFlow-inspired clean neutral palette
- **Design Tokens:** Updated all CSS custom properties to use grayscale-first approach
- **Status Colors:** Changed from neon indicators to subtle tinted backgrounds
- **Shadow System:** Replaced glow effects with soft shadows
- **Typography:** Maintained Inter + JetBrains Mono pairing

### v2.0
- Initial production-ready version with cyberpunk aesthetic
- Full multi-tenant architecture
- AI provider fallback system
- WhatsApp Evolution API integration
