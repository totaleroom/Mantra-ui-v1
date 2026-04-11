import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Role-based route protection
// SUPER_ADMIN: Full access to all routes
// CLIENT_ADMIN: Can access everything except /diagnosis and /settings
// STAFF: Read-only access to inbox and tenants

const PROTECTED_ROUTES = {
  SUPER_ADMIN_ONLY: ['/diagnosis', '/settings'],
  AUTH_REQUIRED: ['/', '/ai-hub', '/whatsapp', '/inbox', '/tenants'],
}

// Session cookie name - should match your auth implementation
const SESSION_COOKIE = 'mantra_session'
const ROLE_HEADER = 'x-user-role'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname === '/login' ||
    pathname === '/auth'
  ) {
    return NextResponse.next()
  }

  // Get session from cookie (in production, verify JWT or session token)
  const session = request.cookies.get(SESSION_COOKIE)?.value
  const userRole = request.headers.get(ROLE_HEADER) || getUserRoleFromSession(session)

  // Check if route requires authentication
  const requiresAuth = PROTECTED_ROUTES.AUTH_REQUIRED.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )

  // For development: allow access without session
  // In production: uncomment the redirect logic below
  if (requiresAuth && !session && process.env.NODE_ENV === 'production') {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Check SUPER_ADMIN only routes
  const isSuperAdminRoute = PROTECTED_ROUTES.SUPER_ADMIN_ONLY.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )

  if (isSuperAdminRoute && userRole !== 'SUPER_ADMIN') {
    // In development, allow access for testing
    if (process.env.NODE_ENV === 'production') {
      // Redirect unauthorized users to home
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  // Add security headers
  const response = NextResponse.next()
  
  // XSS Protection
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // CSP Header for additional XSS protection
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' wss: ws: https:;"
  )

  return response
}

// Helper to extract role from session token
function getUserRoleFromSession(session: string | undefined): string | null {
  if (!session) return null
  
  try {
    // In production, decode JWT and extract role
    // For now, return null and let the backend handle authorization
    // Example JWT decode:
    // const payload = JSON.parse(atob(session.split('.')[1]))
    // return payload.role
    return null
  } catch {
    return null
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}
