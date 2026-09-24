# Aide web: Next.js + Socket.IO (server.js) with headless Chromium for SPA knowledge crawls.
# Stage 1 builds with dev tools, then prunes them; stage 2 ships only runtime files + Chromium.

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

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
ENV NEXT_TELEMETRY_DISABLED=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=10000 \
    CRAWL_BROWSER_ENABLED=1

# Pruned app: production node_modules (incl. playwright + generated Prisma client) and .next.
COPY --from=build /app /app

# Headless Chromium shell matching the installed Playwright, plus its OS libraries.
RUN npx playwright install --with-deps --only-shell chromium \
 && rm -rf /var/lib/apt/lists/* /root/.npm /tmp/* \
 && mkdir -p /app/.next/cache && chown -R node:node /app/.next

EXPOSE 10000
# Run as a normal user. Only .next/cache is written at runtime.
USER node
CMD ["npm", "run", "start"]
