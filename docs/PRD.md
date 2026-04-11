​📑 PRD: Mantra AI (Agentic SaaS Edition)
​Version: 2.0 (Production Ready)
Infrastructure: Hybrid (Next.js Vercel | Go & DB VPS 4GB RAM)
Core Mission: Automasi Agentic Workflow untuk 50+ UMKM dengan WhatsApp Gateway.
​1. Executive Summary
​Mantra AI adalah platform Multi-tenant Agentic SaaS yang menghubungkan UMKM dengan AI Agent otonom melalui WhatsApp. Sistem ini fokus pada efisiensi biaya (multi-provider fallback), privasi (transient memory 4 hari), dan transparansi operasional melalui "Omniscient Inbox".
2. Tech Stack (The "Lean" Machine)
​Frontend: Next.js 14 (App Router) + ShadcnUI + Tailwind (Deployed on Vercel).
​Backend: Go (Golang) Fiber/Gin (Deployed on VPS Debian 12).
​Database: PostgreSQL (Relational) & Redis (Transient Memory & Queue).
​WA Bridge: Evolution API v2 (Dockerized).
​Connectivity: Cloudflare Tunnel (Secure Bridge Vercel-to-VPS).
​3. Feature Matrix (MoSCoW)
​Must-Have (M)
​Multi-tenant Instance: Isolasi data antar klien (1 VPS untuk 50+ klien).
​AI Provider Fallback: Rotasi otomatis antar Groq, OpenRouter, dan OpenAI jika terjadi rate limit atau downtime.
​WhatsApp QR Scanner: Integrasi langsung di dashboard untuk pairing device klien.
​RAG Isolation: Setiap klien memiliki Knowledge Base sendiri yang tidak saling tercampur.
​Should-Have (S)
​Omniscient Inbox: Dashboard pemantau seluruh chat aktif secara real-time.
​AI Thought Process: Kolom khusus yang menampilkan "logika berpikir" AI sebelum menjawab customer.
​Token Billing & Limit: Sistem kuota token per klien dengan notifikasi otomatis.
​Could-Have (C)
​Transient Memory (TTL 4 Days): Memori chat customer yang otomatis terhapus setelah 4 hari untuk privasi.
​System Diagnosis: Panel monitoring kesehatan database, redis, dan WA API dengan saran perbaikan otomatis.
​4. Core Business Logic (The Intelligence Hub)
​Memory Logic: Menggunakan Redis untuk menyimpan context chat. Data memiliki TTL (Time-To-Live) 4 hari. Sebelum AI menjawab, sistem akan melakukan summarization memori singkat untuk menghemat token.
​Fallback Logic: Jika Provider Utama (misal: Groq) mengembalikan error 429 atau 5xx, sistem otomatis berpindah ke Provider Cadangan (misal: OpenRouter) dalam waktu < 500ms.
​Deployment Logic: Frontend di Vercel memanggil Backend di VPS melalui API URL terenkripsi Cloudflare Tunnel.
​5. Dashboard UI Guidelines
​Aesthetic: Dark Mode, Data-Dense, Minimalist (Industrial/Cyber-SaaS).
​Mobile-First: Sidebar harus menjadi drawer di layar kecil, tabel harus scrollable/card-view.
​Interactive: Menggunakan Skeleton loading dan Toasts notification untuk setiap aksi teknis.
​6. Deployment Strategy (Hermes Guide)
​Setiap komponen dibungkus dalam Docker kontainer dengan limitasi RAM ketat:
​Postgres: 512MB RAM Limit.
​Redis: 256MB RAM Limit.
​Evolution API: 1GB RAM Limit.
​Go Backend: 256MB RAM Limit.
​Total Usable RAM: ~2.5GB (Aman untuk VPS 4GB).