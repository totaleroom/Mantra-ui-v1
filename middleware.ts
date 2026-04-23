import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { getServerConfig } from './lib/config'

const SESSION_COOKIE = 'mantra_session'

const SUPER_ADMIN_ONLY = ['/diagnosis', '/settings']
const AUTH_REQUIRED = ['/', '/ai-hub', '/whatsapp', '/inbox', '/tenants', '/diagnosis', '/settings']

// Public paths — always pass through, no auth check.
// `/api/auth` covers login; the rewrite in next.config.mjs forwards
// unmatched `/api/*` to the Go backend, which has its own auth chain,
// so we deliberately don't gate `/api/*` from here.
const PUBLIC_PATHS = ['/login', '/api/auth']

// /change-password must stay reachable to authenticated users while
// they still carry the `mcp` (MustChangePassword) claim — that's the
// whole point: they need to finish rotation before going anywhere
// else. Handled as its own branch in the middleware body below.
const CHANGE_PASSWORD_PATH = '/change-password'

function getJwtSecret(): Uint8Array {
  const secret = getServerConfig()?.jwtSecret || process.env.JWT_SECRET || ''
  return new TextEncoder().encode(secret)
}

interface SessionPayload {
  userId?: string
  email?: string
  role?: string
  exp?: number
  clientId?: number
  // `mcp` (must-change-password) is set at login for seeded / bootstrapped
  // accounts. The backend rejects every request with 428 while this
  // is true; the edge middleware mirrors that gate so nav is redirected.
  mcp?: boolean
}

async function decodeSession(token: string): Promise<SessionPayload | null> {
  const secret = getServerConfig()?.jwtSecret || process.env.JWT_SECRET
  if (!secret) return simpleDecodePayload(token)

  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    return payload as SessionPayload
  } catch {
    return null
  }
}

function simpleDecodePayload(token: string): SessionPayload | null {
  try {
    const [, payloadB64] = token.split('.')
    if (!payloadB64) return null
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json) as SessionPayload
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always pass through: static assets, Next.js internals, public paths
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
  ) {
    return addSecurityHeaders(NextResponse.next())
  }

  const isChangePwPath =
    pathname === CHANGE_PASSWORD_PATH ||
    pathname.startsWith(CHANGE_PASSWORD_PATH + '/')

  const requiresAuth =
    isChangePwPath ||
    AUTH_REQUIRED.some((r) => pathname === r || pathname.startsWith(r + '/'))

  if (!requiresAuth) {
    return addSecurityHeaders(NextResponse.next())
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value

  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  const payload = await decodeSession(token)

  if (!payload) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    const res = NextResponse.redirect(loginUrl)
    res.cookies.delete(SESSION_COOKIE)
    return res
  }

  if (payload.exp && Date.now() / 1000 > payload.exp) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    const res = NextResponse.redirect(loginUrl)
    res.cookies.delete(SESSION_COOKIE)
    return res
  }

  // Force-rotation gate — mirrors backend BlockUntilPasswordChanged().
  // If the JWT still carries `mcp=true` we only allow /change-password
  // (and its POST server action); every other protected route bounces
  // back to the rotation page.
  if (payload.mcp && !isChangePwPath) {
    return NextResponse.redirect(new URL(CHANGE_PASSWORD_PATH, request.url))
  }
  // Symmetric: if rotation is already done, don't let users re-visit
  // /change-password (they'd have no current password to supply).
  if (!payload.mcp && isChangePwPath) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const isSuperAdminOnly = SUPER_ADMIN_ONLY.some(
    (r) => pathname === r || pathname.startsWith(r + '/')
  )

  if (isSuperAdminOnly && payload.role !== 'SUPER_ADMIN') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const response = NextResponse.next()
  if (payload.role) response.headers.set('x-user-role', payload.role)
  if (payload.userId) response.headers.set('x-user-id', String(payload.userId))
  return addSecurityHeaders(response)
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'SAMEORIGIN')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
}
