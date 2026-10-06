# Aide web: Next.js + Socket.IO (server.js) with headless Chromium for SPA knowledge crawls.
# Stage 1 builds with dev tools, then prunes them; stage 2 ships only runtime files + Chromium.

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    # Cap Next page-data workers — Render build hosts report many CPUs; unbounded
    # workers OOM during "Collecting page data".
    NEXT_BUILD_CPUS=2 \
    NODE_OPTIONS=--max-old-space-size=3072

# Prisma needs OpenSSL on slim images (postinstall prisma generate).
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# postinstall runs `prisma generate` (no database needed).
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci --include=dev

COPY . .
# NEXT_PUBLIC_* are inlined at build time. Render passes service env vars as build args.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
RUN npm run build \
 && npm prune --omit=dev \
 && rm -rf .next/cache /root/.npm

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
# CRAWL_BROWSER_ENABLED is set per service on Render (0 on web, 1 on aide-jobs).
ENV NEXT_TELEMETRY_DISABLED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=10000

RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Pruned app: production node_modules (incl. playwright + generated Prisma client) and .next.
COPY --from=build /app /app

# Headless Chromium shell matching the installed Playwright, plus its OS libraries.
RUN npx playwright install --with-deps --only-shell chromium \
 && rm -rf /var/lib/apt/lists/* /root/.npm /tmp/* \
 && mkdir -p /app/.next/cache && chown -R node:node /app/.next

EXPOSE 10000
# Run as a normal user. Only .next/cache is written at runtime.
USER node
# SERVICE_ROLE=web|jobs selects process (Render Docker cannot set dockerCommand via CLI).
CMD ["sh", "scripts/render-entrypoint.sh"]
