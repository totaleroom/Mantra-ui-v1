/**
 * Mantra AI — Centralised Environment Configuration
 *
 * Grouped into three layers:
 *   1. publicConfig   — NEXT_PUBLIC_* vars, safe in browser + Edge + Node
 *   2. serverConfig   — server-only secrets, returns null on the client
 *   3. validateServerConfig() — call once at app startup to fail fast
 *
 * Vercel / Edge Runtime compatible:
 *   • No dynamic requires, no fs, no Node-only APIs at module scope.
 *   • Server-only block is gated behind typeof window === 'undefined'.
 */

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function pub(key: string, fallback = ''): string {
  return (
    (typeof process !== 'undefined' && process.env?.[key]) || fallback
  )
}

function bool(key: string, fallback = false): boolean {
  const val = pub(key)
  if (val === '') return fallback
  return val === 'true' || val === '1'
}

// ─────────────────────────────────────────────────────────────
// 1. Public Config — browser + server + edge safe
// ─────────────────────────────────────────────────────────────

export const publicConfig = {
  /** Base URL of the Go Fiber API */
  apiUrl: pub('NEXT_PUBLIC_API_URL', 'http://localhost:3001'),

  /** WebSocket base URL (ws:// or wss://) */
  wsUrl: pub('NEXT_PUBLIC_WS_URL', 'ws://localhost:3001'),

  /** Evolution API instance name (safe to expose) */
  evoInstanceName: pub('NEXT_PUBLIC_EVO_INSTANCE_NAME', 'mantra_instance'),

  /** Canonical public URL of this Next.js app */
  baseUrl: pub('NEXT_PUBLIC_BASE_URL', 'http://localhost:5000'),

  /** Show React Query DevTools in browser */
  enableDevtools: bool('NEXT_PUBLIC_ENABLE_DEVTOOLS', false),

  /** Use mock data instead of live API calls */
  enableMockData: bool('NEXT_PUBLIC_ENABLE_MOCK_DATA', false),
} as const

// ─────────────────────────────────────────────────────────────
// 2. Server Config — only populated on the server
//    Returns null in browser / Edge (client-side rendering).
// ─────────────────────────────────────────────────────────────

function serverEnv(key: string, fallback = ''): string {
  return (typeof process !== 'undefined' && process.env?.[key]) || fallback
}

export const serverConfig =
  typeof window === 'undefined'
    ? {
        // ── [CORE] ────────────────────────────────────────────
        port: serverEnv('PORT', '3001'),
        nodeEnv: serverEnv('NODE_ENV', 'development'),
        jwtSecret: serverEnv('JWT_SECRET'),

        // ── [DATABASE] ────────────────────────────────────────
        databaseUrl: serverEnv('DATABASE_URL'),
        redisUrl: serverEnv('REDIS_URL', 'redis://localhost:6379'),

        // ── [EVOLUTION_API] ───────────────────────────────────
        // EVO_* is canonical; EVOLUTION_API_* is the legacy fallback
        evoApiUrl: serverEnv('EVO_API_URL') || serverEnv('EVOLUTION_API_URL', 'http://localhost:8080'),
        evoApiKey: serverEnv('EVO_API_KEY') || serverEnv('EVOLUTION_API_KEY', ''),
        evoInstanceName: serverEnv('EVO_INSTANCE_NAME', 'mantra_instance'),

        // ── [AGENTIC_AI] ──────────────────────────────────────
        hermesAuthToken: serverEnv('HERMES_AUTH_TOKEN'),
        agentCallbackUrl: serverEnv('AGENT_CALLBACK_URL'),

        // ── [DEPLOYMENT] ──────────────────────────────────────
        frontendUrl: serverEnv('FRONTEND_URL'),
      }
    : null

// ─────────────────────────────────────────────────────────────
// 3. Startup Validation — call in app/layout.tsx (server component)
//    Throws with a clear message for every missing required var.
// ─────────────────────────────────────────────────────────────

const REQUIRED_SERVER_VARS: { key: string; description: string }[] = [
  { key: 'JWT_SECRET',      description: 'JWT signing secret for authentication' },
  { key: 'DATABASE_URL',    description: 'PostgreSQL connection string' },
  { key: 'FRONTEND_URL',    description: 'Canonical frontend URL (drives CORS)' },
  { key: 'EVO_API_KEY',     description: 'Evolution API authentication key' },
  { key: 'EVO_API_URL',     description: 'Evolution API base URL' },
  { key: 'HERMES_AUTH_TOKEN', description: 'Hermes agent auth token' },
]

export function validateServerConfig(): void {
  if (typeof window !== 'undefined') return
  if (serverEnv('NODE_ENV') !== 'production') return

  const missing: string[] = []

  for (const { key, description } of REQUIRED_SERVER_VARS) {
    const val =
      serverEnv(key) ||
      (key === 'EVO_API_KEY' ? serverEnv('EVOLUTION_API_KEY') : '') ||
      (key === 'EVO_API_URL' ? serverEnv('EVOLUTION_API_URL') : '')

    if (!val) {
      missing.push(`  • ${key}  →  ${description}`)
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `[Mantra] Missing required environment variables:\n${missing.join('\n')}\n\n` +
      `Copy .env.example to .env and fill in the missing values.`
    )
  }
}

// ─────────────────────────────────────────────────────────────
// Re-export as default for convenience
// ─────────────────────────────────────────────────────────────

const config = { public: publicConfig, server: serverConfig }
export default config
