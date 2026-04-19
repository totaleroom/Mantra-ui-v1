/** @type {import('next').NextConfig} */

// Build a strict, production-ready Content Security Policy.
// unsafe-inline on styles is required by Tailwind JIT runtime;
// unsafe-eval is required by Next.js dev HMR; we only allow it outside production.
const isProd = process.env.NODE_ENV === 'production'

const apiOrigin = process.env.NEXT_PUBLIC_API_URL || ''
const wsOrigin = process.env.NEXT_PUBLIC_WS_URL || ''
const evoOrigin = process.env.NEXT_PUBLIC_EVO_URL || ''

// connect-src allowlist: explicit origins only. Previous version included
// bare `ws:` / `wss:` / `https:` which matched ANY origin and defeated the
// point of the whitelist. If you legitimately need a third-party API in
// the browser (analytics, Sentry, etc.) add its origin here.
const connectSrc = [
  `'self'`,
  apiOrigin,
  wsOrigin,
  evoOrigin,
  // Dev-only: allow webpack-dev-server HMR over localhost.
  isProd ? '' : 'ws://localhost:*',
  isProd ? '' : 'http://localhost:*',
]
  .filter(Boolean)
  .join(' ')

const csp = [
  `default-src 'self'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'self'`,
  `object-src 'none'`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self' data:`,
  `style-src 'self' 'unsafe-inline'`,
  `script-src 'self'${isProd ? '' : " 'unsafe-eval' 'unsafe-inline'"}`,
  `connect-src ${connectSrc}`,
  `upgrade-insecure-requests`,
].join('; ')

const nextConfig = {
  // Standalone output — required for Docker/Coolify deployment
  // Bundles only the necessary files for production (no node_modules copy)
  output: 'standalone',

  reactStrictMode: true,
  poweredByHeader: false,

  // TypeScript: enforced. Build fails on type errors (no more silent drift).
  typescript: {
    ignoreBuildErrors: false,
  },

  // Next.js 16 infers the workspace root from the nearest lockfile.
  // Pin it to this directory so a stray lockfile in the parent folder is ignored.
  turbopack: {
    root: process.cwd(),
  },

  images: {
    // Enable Next.js image optimizer in production for bandwidth & CLS wins.
    // If you genuinely need external sources that the optimizer can't reach
    // (e.g. behind-VPN assets), re-enable `unoptimized: true`.
    unoptimized: false,
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      // Evolution API QR base64 data URLs come inline, so no remote host needed.
      // Add specific hostnames below when you have real external image sources.
      // { protocol: 'https', hostname: 'cdn.yourdomain.com' },
    ],
  },

  // Allow Windsurf browser preview and local hosts during dev.
  allowedDevOrigins: ['localhost', '127.0.0.1', '0.0.0.0'],

  // ─────────────────────────────────────────────────────────────
  // Reverse-proxy /api/* to the Go Fiber backend.
  //
  // Why this exists: the browser's session cookie is set on the
  // Next.js origin (e.g. https://app.example.com). If the frontend
  // then fetched https://api.example.com directly, the browser would
  // refuse to attach the cookie (cross-origin, HttpOnly, SameSite=Lax).
  // By rewriting same-origin `/api/*` → backend we keep the cookie
  // path simple: one origin, one cookie, zero CORS pain.
  //
  // `afterFiles` means Next.js route handlers (`app/api/...`) take
  // precedence, so `/api/auth/logout` and `/api/whatsapp/providers`
  // stay local. Everything else falls through to the Go backend.
  //
  // BACKEND_INTERNAL_URL is resolved at runtime on the Node server,
  // so it works equally in `next dev`, `next start`, and inside the
  // Docker container (where it'll be http://backend:3001).
  async rewrites() {
    const backend =
      process.env.BACKEND_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://localhost:3001'
    return {
      afterFiles: [
        {
          source: '/api/:path*',
          destination: `${backend}/api/:path*`,
        },
      ],
    }
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
      // CORS for Next.js API routes — mirrors the Go backend's CORS policy.
      // Use explicit origin only (never '*') when credentials are included.
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.FRONTEND_URL || 'http://localhost:5000',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization, X-Requested-With',
          },
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
        ],
      },
    ]
  },

  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    // Dev-only: whitelist localhost origins so Server Actions don't 403
    // when accessed through a browser-preview proxy (Windsurf, VSCode,
    // etc. use dynamic ports on 127.0.0.1). Production keeps strict
    // same-origin checks.
    //
    // Previous revision pre-generated 32k entries for the full ephemeral
    // port range (49152-65535 × 2 hostnames) which shipped ~33k strings
    // into Next's in-memory config. That was wasteful; Next 14+ accepts
    // regex-flavoured entries that cover the whole range in one line.
    serverActions: isProd
      ? undefined
      : {
          allowedOrigins: [
            'localhost:5000',
            '127.0.0.1:5000',
            '0.0.0.0:5000',
            // Ephemeral ports (49152-65535 per IANA) for both host names.
            // Matches any 5-digit port in the ephemeral range without
            // the 32k string array we used to carry.
            'localhost:*',
            '127.0.0.1:*',
          ],
          allowedForwardedHosts: [
            'localhost:5000',
            '127.0.0.1:5000',
            '0.0.0.0:5000',
          ],
        },
  },
}

export default nextConfig
