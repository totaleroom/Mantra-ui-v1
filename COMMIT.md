feat(architecture): comprehensive system redesign with credential centralization & security hardening

This commit represents a major architecture milestone for Mantra AI, a multi-tenant
SaaS platform for AI-powered WhatsApp automation. The changes establish
production-ready patterns for environment management, credential security, and
system documentation.

## 🏗️ Architecture Documentation

- **ARCHITECTURE.md**: Comprehensive system documentation including:
  - Complete tech stack breakdown (Next.js 14, Go Fiber, PostgreSQL 15, Redis 7, Evolution API)
  - Service architecture diagrams with Docker Compose topology
  - Network ports, API endpoints, and data flow documentation
  - Database schema reference and integration points
  - Environment variable dependency matrix
  - Security architecture and role-based access control
  - Development guidelines and deployment environments

## 🔐 Credential Centralization & Security

### Environment Management
- **Enhanced .env.example**: Completely restructured with grouped sections:
  - [FRONTEND_NEXTJS] — Public variables (browser-safe)
  - [BACKEND_GO] — Server-only configuration
  - [DATABASE_POSTGRES] — PostgreSQL & Redis settings
  - [WHATSAPP_PROVIDER] — Evolution API integration
  - [AGENTIC_AI] — LLM provider keys & webhooks
  - [FEATURE_FLAGS] — Development toggles
  - [DEPLOYMENT_VPS] — Production Docker settings
  - Security checklist for production deployment

### Atom-Level Environment Sync
- **lib/auth.ts**: Refactored direct `process.env.JWT_SECRET` and `process.env.BACKEND_INTERNAL_URL` to use centralized `serverConfig`
- **proxy.ts**: Refactored direct `process.env.JWT_SECRET` access to use `serverConfig` with fallback for Edge compatibility
- All environment access now flows through:
  - `lib/env.ts` — Zod schema validation (server + client)
  - `lib/config.ts` — Runtime config with serverConfig/serverEnv
  - `backend/config/config.go` — Go-side validation with production requirements

### Secret Purge
- **backend/database/init.sql**: Added safety checks and documentation for default user seeding
  - Wrapped in environment-aware conditional logic
  - Clear warnings about DEVELOPMENT ONLY usage
  - Instructions for production-safe user creation

## 🛡️ Git Security Lockdown

### Strict .gitignore Rules
Completely rewritten `.gitignore` with categorized security patterns:
- Environment files (.env, .env.*) with exception for .env.example
- Secrets (*.pem, *.key, *.cert, secrets/)
- Dependencies (node_modules/, vendor/)
- Build outputs (.next/, dist/, Go binaries)
- Large artifacts (.local/, .agents/, .config/)
- IDE files (.idea/, .vscode/)
- Log files and debug output
- Local database files

## 📊 System Specification

| Component | Technology | Port | Memory |
|-----------|------------|------|--------|
| Frontend | Next.js 14 (App Router) | 5000 | 256MB |
| Backend | Go Fiber | 3001 | 256MB |
| Database | PostgreSQL 15 | 5432 | 512MB |
| Cache | Redis 7 | 6379 | 256MB |
| WhatsApp | Evolution API | 8080 | 1GB |
| **Total** | | | **< 2.6GB** |

## 🔧 Integration Points

### Evolution API (WhatsApp Gateway)
- Base URL: `EVO_API_URL` (env-configured)
- Authentication: Header `apikey: EVO_API_KEY`
- Webhooks: Go backend receives `/webhook/evolution`
- QR Streaming: WebSocket + polling hybrid

### AI Providers (LLM Integration)
- Supported: OpenAI, Groq, OpenRouter
- Fallback chain: Priority-sorted provider list
- Configuration: `client_ai_configs` table per tenant

## 🚀 Deployment Ready

This commit prepares the codebase for:
- Docker Compose deployment (< 2.6GB RAM budget)
- Cloudflare Tunnel integration
- Vercel frontend + VPS backend split
- Production environment validation

## 📚 Documentation

- `ARCHITECTURE.md` — System architecture reference
- `.env.example` — Comprehensive environment template
- `COMMIT.md` — This message

---

Breaking Changes: None (all changes are additive/refactoring)
Migration: Copy `.env.example` to `.env` and fill in values
Co-authored-by: Principal AI Architect & Vibe Coding Orchestrator
