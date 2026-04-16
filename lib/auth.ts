import { jwtVerify, type JWTPayload } from 'jose'
import { cookies } from 'next/headers'
import { publicConfig } from './config'

export const SESSION_COOKIE = 'mantra_session'

export interface MantraSession {
  userId: string
  email: string
  role: 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'STAFF'
  exp: number
  iat: number
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
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

export async function callLoginAPI(email: string, password: string): Promise<LoginResult> {
  // Prefer BACKEND_INTERNAL_URL for server-to-server calls (docker network / VPS internal)
  // Fall back to NEXT_PUBLIC_API_URL for dev environments
  const apiUrl =
    process.env.BACKEND_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3001'

  let res: Response
  try {
    res = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      cache: 'no-store',
    })
  } catch {
    return { ok: false, error: 'Cannot reach the server. Please try again.' }
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    return { ok: false, error: data?.error || 'Invalid credentials' }
  }

  return {
    ok: true,
    token: data.token,
    user: data.user,
  }
}
