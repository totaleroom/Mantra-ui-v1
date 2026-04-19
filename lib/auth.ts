import { jwtVerify, SignJWT, type JWTPayload } from 'jose'
import { cookies } from 'next/headers'
import { publicConfig, serverConfig } from './config'

export const SESSION_COOKIE = 'mantra_session'

export interface MantraSession {
  userId: string
  email: string
  role: 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'STAFF'
  exp: number
  iat: number
}

function getJwtSecret(): Uint8Array {
  const secret = serverConfig?.jwtSecret
  if (!secret) {
    throw new Error('[Auth] JWT_SECRET environment variable is not set')
  }
  return new TextEncoder().encode(secret)
}

export async function verifySession(token: string): Promise<(JWTPayload & MantraSession) | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return payload as JWTPayload & MantraSession
  } catch {
    return null
  }
}

export async function getServerSession(): Promise<MantraSession | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE)?.value
    if (!token) return null
    return verifySession(token)
  } catch {
    return null
  }
}

export interface LoginResult {
  ok: boolean
  error?: string
  token?: string
  user?: {
    id: string
    email: string
    role: string
  }
}

/**
 * Dev-only: issue a locally-signed JWT when backend is unreachable.
 * Active only when DEV_AUTH_BYPASS=true AND NODE_ENV !== 'production'.
 * Accepts any of the seed accounts (admin@mantra.ai, demo@mantra.ai) + any password.
 *
 * Belt-and-suspenders: the caller guards on serverConfig.devAuthBypass,
 * but we ALSO re-check NODE_ENV inside this function so there is no
 * possible code path that emits a bypass token in production even if a
 * future refactor forgets the outer check.
 */
async function devAuthIssue(email: string): Promise<LoginResult> {
  if (process.env.NODE_ENV === 'production') {
    return { ok: false, error: 'dev auth is disabled in production' }
  }

  const secret = serverConfig?.jwtSecret
  if (!secret) {
    return { ok: false, error: '[DEV] JWT_SECRET not set in .env' }
  }

  const role: MantraSession['role'] =
    email === 'admin@mantra.ai' ? 'SUPER_ADMIN' : 'CLIENT_ADMIN'
  const userId = email === 'admin@mantra.ai' ? '1' : '2'
  // Dev bypass cannot possibly know the real tenant mapping; assign
  // the seeded demo tenant (id=1 created by init.sql's bootstrap block)
  // for CLIENT_ADMIN. SUPER_ADMIN remains tenant-agnostic.
  const clientId = role === 'SUPER_ADMIN' ? undefined : 1

  // Match backend session duration (see backend/handlers/auth.go:sessionDuration).
  const token = await new SignJWT({ userId, email, role, clientId, mcp: false })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setNotBefore(Math.floor(Date.now() / 1000))
    .setExpirationTime('8h')
    .sign(new TextEncoder().encode(secret))

  return {
    ok: true,
    token,
    user: { id: userId, email, role },
  }
}

export async function callLoginAPI(email: string, password: string): Promise<LoginResult> {
  // Prefer BACKEND_INTERNAL_URL for server-to-server calls (docker network / VPS internal)
  // Fall back to NEXT_PUBLIC_API_URL for dev environments
  const apiUrl =
    serverConfig?.backendInternalUrl ||
    publicConfig.apiUrl

  let res: Response
  try {
    res = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    })
  } catch {
    // Backend unreachable — dev bypass (only in dev mode)
    if (serverConfig?.devAuthBypass) {
      console.warn('[Auth] Backend unreachable, using DEV_AUTH_BYPASS for', email)
      return devAuthIssue(email)
    }
    return { ok: false, error: 'Cannot reach the server. Please try again.' }
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    // If backend rejects (e.g., no DB), try dev bypass as last resort
    if (serverConfig?.devAuthBypass) {
      console.warn('[Auth] Backend rejected login, using DEV_AUTH_BYPASS for', email)
      return devAuthIssue(email)
    }
    return { ok: false, error: data?.error || 'Invalid credentials' }
  }

  return {
    ok: true,
    token: data.token,
    user: data.user,
  }
}
