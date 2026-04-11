# Mantra AI - Command Center Dashboard

> Agentic SaaS Dashboard for Multi-Tenant AI WhatsApp Automation

Production-ready frontend for managing 50+ UMKM clients with AI-powered WhatsApp automation.

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | Next.js 14 (App Router) | Server/Client rendering, routing |
| **UI Library** | ShadcnUI + Tailwind CSS 4 | Component library, styling |
| **State Management** | TanStack Query v5 | Server state, caching, mutations |
| **Forms** | React Hook Form + Zod | Form handling, validation |
| **Real-time** | Native WebSocket | Live inbox updates, QR streaming |
| **Deployment** | Vercel | Edge deployment, analytics |

## Directory Structure

```
mantra-ui/
├── app/                          # Next.js App Router pages
│   ├── page.tsx                  # Dashboard overview
│   ├── ai-hub/page.tsx           # AI Provider management
│   ├── whatsapp/page.tsx         # WhatsApp Gateway (Evolution API)
│   ├── inbox/page.tsx            # Omniscient Inbox (real-time)
│   ├── tenants/
│   │   ├── page.tsx              # Tenant list
│   │   └── [id]/page.tsx         # Tenant configuration
│   ├── diagnosis/page.tsx        # System health (SUPER_ADMIN only)
│   ├── settings/page.tsx         # Global settings (SUPER_ADMIN only)
│   ├── layout.tsx                # Root layout with providers
│   └── globals.css               # Design tokens, theme
│
├── components/
│   ├── dashboard/                # Layout components
│   │   ├── sidebar.tsx           # Mobile-responsive navigation
│   │   ├── header.tsx            # Page header
│   │   └── dashboard-layout.tsx  # Main layout wrapper
│   │
│   ├── ai-hub/                   # AI Provider components
│   │   ├── add-provider-dialog.tsx
│   │   ├── ai-provider-card.tsx
│   │   └── model-selector.tsx
│   │
│   ├── whatsapp/                 # WhatsApp Gateway components
│   │   ├── create-instance-dialog.tsx
│   │   ├── instance-card.tsx
│   │   └── qr-code-dialog.tsx    # Base64 QR stream support
│   │
│   ├── inbox/                    # Inbox components
│   │   ├── message-card.tsx      # XSS-sanitized messages
│   │   └── thought-process-panel.tsx
│   │
│   ├── diagnosis/                # System diagnosis components
│   │   ├── service-status-card.tsx
│   │   └── ai-recommendation-panel.tsx
│   │
│   ├── providers/
│   │   └── query-provider.tsx    # TanStack Query setup
│   │
│   └── ui/                       # ShadcnUI components
│
├── hooks/                        # Custom React hooks
│   ├── use-ai-provider.ts        # AI provider CRUD operations
│   ├── use-whatsapp.ts           # WhatsApp instance + QR streaming
│   ├── use-inbox.ts              # Real-time inbox WebSocket
│   ├── use-tenant.ts             # Tenant configuration
│   └── index.ts                  # Barrel export
│
├── lib/
│   ├── api-client.ts             # Typed fetch wrapper
│   ├── types.ts                  # TypeScript interfaces
│   ├── validations.ts            # Zod schemas
│   ├── sanitize.ts               # XSS prevention utilities
│   ├── utils.ts                  # Utility functions
│   └── mock-data.ts              # Development mock data
│
├── docs/                         # Documentation
│   ├── schema.ts                 # Database schema (Drizzle ORM)
│   ├── PRD.md                    # Product requirements
│   ├── api-contract.md           # API endpoint specifications
│   ├── deployment-guide.md       # VPS deployment instructions
│   ├── backend-boilerplate-hint.go
│   ├── vercel-env-list.txt       # Environment variables
│   └── handover-manifest.md      # Integration summary
│
├── middleware.ts                 # Route protection, security headers
├── next.config.mjs               # Next.js configuration
└── package.json
```

## Environment Variables

Required for Vercel deployment:

```env
# Backend API (Go Fiber via Cloudflare Tunnel)
NEXT_PUBLIC_API_URL=https://api.mantra.yourdomain.com

# WebSocket endpoints (same domain, different path)
NEXT_PUBLIC_WS_URL=wss://api.mantra.yourdomain.com

# Optional: Analytics
NEXT_PUBLIC_VERCEL_ANALYTICS_ID=your-analytics-id
```

## Getting Started

```bash
# Install dependencies
pnpm install

# Development
pnpm dev

# Production build
pnpm build
pnpm start
```

## Role-Based Access Control

| Role | Access |
|------|--------|
| `SUPER_ADMIN` | Full access to all routes including `/diagnosis` and `/settings` |
| `CLIENT_ADMIN` | All routes except `/diagnosis` and `/settings` |
| `STAFF` | Read-only access to `/inbox` and `/tenants` |

Route protection is handled in `middleware.ts` with security headers for XSS prevention.

## Backend Integration Handover

### For Go Fiber Backend Developers

1. **Read the API Contract**: See `docs/api-contract.md` for all endpoints, request/response schemas, and WebSocket events.

2. **Use the Boilerplate**: `docs/backend-boilerplate-hint.go` contains Go structs matching the frontend types exactly.

3. **Database Schema**: `docs/schema.ts` is the Drizzle ORM schema - use this as the source of truth for PostgreSQL tables.

4. **WebSocket Requirements**:
   - `/api/inbox/live` - Real-time message feed (JSON messages)
   - `/api/whatsapp/instances/:name/qr` - Base64 QR code stream

5. **CORS Configuration**: Backend must allow:
   - Origins: Your Vercel domain
   - Methods: GET, POST, PUT, DELETE, PATCH
   - Headers: Content-Type, Authorization

### For Hermes Agent (VPS Deployment)

See `docs/deployment-guide.md` for complete Docker Compose setup including:
- PostgreSQL (512MB RAM limit)
- Redis (256MB RAM limit)  
- Evolution API (1GB RAM limit)
- Go Backend (256MB RAM limit)
- Cloudflare Tunnel configuration

## Security Features

- **Route Protection**: Middleware-based role checks
- **XSS Prevention**: All dynamic content sanitized via `lib/sanitize.ts`
- **CSP Headers**: Strict Content Security Policy
- **Input Validation**: Zod schemas for all forms
- **Secure Cookies**: HTTP-only session cookies (backend implementation)

## Performance Optimizations

- **Skeleton Loading**: Every data-fetching page has skeleton states
- **Optimistic Updates**: Instant UI feedback for toggle operations
- **Query Caching**: TanStack Query with smart invalidation
- **Code Splitting**: Dynamic imports for large components
- **Mobile-First**: Responsive design with mobile drawer navigation

## Built with v0

This repository is linked to a [v0](https://v0.app) project.

[Continue working on v0](https://v0.app/chat/projects/prj_kYxKkN9jPU30qLrvrEHOsskTIydA)

## License

Proprietary - Mantra AI
