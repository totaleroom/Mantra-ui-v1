import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const SESSION_COOKIE = 'mantra_session'

const SUPER_ADMIN_ONLY = ['/diagnosis', '/settings']
const AUTH_REQUIRED = ['/', '/ai-hub', '/whatsapp', '/inbox', '/tenants', '/diagnosis', '/settings']

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || ''
  return new TextEncoder().encode(secret)
}

interface SessionPayload {
  userId?: string
  email?: string
  role?: string
  exp?: number
}

async function decodeSession(token: string): Promise<SessionPayload | null> {
  const secret = process.env.JWT_SECRET
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

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.includes('.') ||
    pathname === '/login'
  ) {
    return addSecurityHeaders(NextResponse.next())
  }

  const requiresAuth = AUTH_REQUIRED.some(
    (r) => pathname === r || pathname.startsWith(r + '/')
  )

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

  const isSuperAdminOnly = SUPER_ADMIN_ONLY.some(
    (r) => pathname === r || pathname.startsWith(r + '/')
  )

  if (isSuperAdminOnly && payload.role !== 'SUPER_ADMIN') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const response = NextResponse.next()
  if (payload.role) response.headers.set('x-user-role', payload.role)
  if (payload.userId) response.headers.set('x-user-id', payload.userId)
  return addSecurityHeaders(response)
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' wss: ws: https:;"
  )
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
}
