# =============================================================
# Mantra AI — Frontend Dockerfile (Next.js standalone)
# Multi-stage build for Coolify/VPS deployment
# Output: standalone bundle (~150 MB, no node_modules copy)
# =============================================================

# ── Stage 1: Dependencies ─────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Pin pnpm to the same major version that produced pnpm-lock.yaml
# (lockfileVersion: "9.0", produced by pnpm 9.x/10.x). `pnpm@latest`
# would silently pull a future major and fail the frozen-lockfile check.
RUN npm install -g pnpm@10

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# ── Stage 2: Builder ──────────────────────────────────────────
FROM node:20-alpine AS builder
RUN npm install -g pnpm@10
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build args become env vars during build. Every NEXT_PUBLIC_* value is
# baked into the JS bundle at build time, so if it isn't declared here
# the client side will receive `undefined` no matter what's in the
# runtime environment. Keep this list in lockstep with publicConfig
# in lib/config.ts.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_WS_URL=ws://localhost:3001
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_EVO_URL
ARG NEXT_PUBLIC_BASE_URL=http://localhost:5000
ARG NEXT_PUBLIC_EVO_INSTANCE_NAME=mantra_instance

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_EVO_URL=$NEXT_PUBLIC_EVO_URL
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_EVO_INSTANCE_NAME=$NEXT_PUBLIC_EVO_INSTANCE_NAME
ENV NEXT_TELEMETRY_DISABLED=1

# Cap Node heap at 1.5 GB during build. Our target VPS (4 GB RAM)
# coexists with postgres+redis+evolution+backend during the build
# itself; uncapped, `next build` can spike past 2 GB and the kernel
# starts swapping heavily (or OOM-kills). 1.5 GB is enough for the
# current bundle size (~200 routes) and leaves headroom for the
# other containers. Bump if the bundle grows past this envelope.
ENV NODE_OPTIONS="--max-old-space-size=1536"

RUN pnpm build

# ── Stage 3: Runner ───────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output (only what's needed to run)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 5000

ENV PORT=5000
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# /login is an always-reachable public page (no auth, no server data) so
# wget GET returns 200. Using a POST-only endpoint here (the old
# /api/auth/logout) makes the healthcheck forever unhealthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q --spider http://localhost:5000/login || exit 1

CMD ["node", "server.js"]
