/**
 * Mantra AI — Zod Environment Schema
 * Validates all environment variables at startup with clear fatal errors.
 * Import this at the top of app/layout.tsx (server component) to fail fast.
 */
import { z } from 'zod'

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Auth
  JWT_SECRET: z
    .string()
    .min(16, 'JWT_SECRET must be at least 16 characters')
    .refine((v) => v !== 'change-me-in-production-please', {
      message: 'JWT_SECRET must be changed from the default value',
    }),

  // Backend (internal — used for server-to-server calls)
  BACKEND_INTERNAL_URL: z
    .string()
    .url('BACKEND_INTERNAL_URL must be a valid URL')
    .default('http://localhost:3001'),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL URL').optional(),
  REDIS_URL: z.string().url('REDIS_URL must be a valid Redis URL').optional(),

  // Evolution API
  EVO_API_URL: z.string().url('EVO_API_URL must be a valid URL').optional(),
  EVO_API_KEY: z.string().optional(),
  EVO_INSTANCE_NAME: z.string().default('mantra_instance'),

  // Agentic AI
  HERMES_AUTH_TOKEN: z.string().optional(),
  AGENT_CALLBACK_URL: z.string().url('AGENT_CALLBACK_URL must be a valid URL').optional(),

  // CORS
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL').optional(),
})

const clientSchema = z.object({
  // These are bundled into the browser — must use NEXT_PUBLIC_ prefix
  NEXT_PUBLIC_API_URL: z
    .string()
    .optional(),
  NEXT_PUBLIC_WS_URL: z
    .string()
    .optional(),
  NEXT_PUBLIC_BACKEND_URL: z
    .string()
    .url()
    .optional(),
  NEXT_PUBLIC_EVO_URL: z
    .string()
    .url()
    .optional(),
  NEXT_PUBLIC_EVO_INSTANCE_NAME: z.string().default('mantra_instance'),
  NEXT_PUBLIC_BASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_ENABLE_DEVTOOLS: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  NEXT_PUBLIC_ENABLE_MOCK_DATA: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
})

// ─── Server-side validation (Node.js only) ───────────────────
function validateServerEnv() {
  if (typeof window !== 'undefined') return null

  const result = serverSchema.safeParse(process.env)

  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n')

    const message =
      `\n[Mantra] FATAL: Invalid environment variables:\n${errors}\n\n` +
      `Copy .env.example to .env and set all required values.\n`

    if (process.env.NODE_ENV === 'production') {
      throw new Error(message)
    } else {
      console.warn(message)
    }
    return null
  }

  return result.data
}

// ─── Client-side env (always safe to parse) ──────────────────
function validateClientEnv() {
  const result = clientSchema.safeParse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
    NEXT_PUBLIC_EVO_URL: process.env.NEXT_PUBLIC_EVO_URL,
    NEXT_PUBLIC_EVO_INSTANCE_NAME: process.env.NEXT_PUBLIC_EVO_INSTANCE_NAME,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_ENABLE_DEVTOOLS: process.env.NEXT_PUBLIC_ENABLE_DEVTOOLS,
    NEXT_PUBLIC_ENABLE_MOCK_DATA: process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA,
  })

  if (!result.success) {
    console.warn(
      '[Mantra] Client env validation issues:',
      result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    )
    return clientSchema.parse({
      NEXT_PUBLIC_API_URL: 'http://localhost:3001',
      NEXT_PUBLIC_WS_URL: 'ws://localhost:3001',
    })
  }

  return result.data
}

export const serverEnv = validateServerEnv()
export const clientEnv = validateClientEnv()
