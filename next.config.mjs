/** @type {import('next').NextConfig} */

// Build a strict, production-ready Content Security Policy.
// unsafe-inline on styles is required by Tailwind JIT runtime;
// unsafe-eval is required by Next.js dev HMR; we only allow it outside production.
const isProd = process.env.NODE_ENV === 'production'

const apiOrigin = process.env.NEXT_PUBLIC_API_URL || ''
const wsOrigin = process.env.NEXT_PUBLIC_WS_URL || ''

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
  `connect-src 'self' ${apiOrigin} ${wsOrigin} ws: wss: https:`.trim(),
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
    // Dev-only: whitelist common localhost origins so Server Actions don't
    // 403 when accessed through a browser-preview proxy (Windsurf uses a
    // dynamic port on 127.0.0.1). Production keeps strict same-origin checks.
    serverActions: isProd
      ? undefined
      : {
          allowedOrigins: [
            'localhost:5000',
            '127.0.0.1:5000',
            // Windsurf browser preview proxy — explicit list of the
            // ports we've seen so far. Append more here if needed.
            '127.0.0.1:52446',
            '127.0.0.1:52447',
            '127.0.0.1:52448',
            '127.0.0.1:52449',
            '127.0.0.1:52450',
          ],
          allowedForwardedHosts: ['localhost:5000', '127.0.0.1:5000'],
        },
  },
}

export default nextConfig
