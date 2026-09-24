# Deploy on Render (Singapore)

Blueprint: [`render.yaml`](../../render.yaml). Every service runs in `singapore`, next to Neon `ap-southeast-1`.

## Why Singapore

A chat turn makes ~25 sequential database queries before the model starts. Measured 2026-09-24:

| App ↔ Neon | Per query | Setup before the LLM |
| --- | --- | --- |
| Pakistan dev machine → Singapore | ~100 ms | ~2.4–3.1 s |
| Same region (Render Singapore) | ~1–2 ms | ~50 ms |

`CHAT_SLOW` logs (turns > 4 s) carry per-step `spans` if this regresses.

## Services

| Name | Type | Notes |
| --- | --- | --- |
| `aide-web` | Web service, **Docker** (standard) | [`Dockerfile`](../../Dockerfile): Node 22 + headless Chromium; `server.js` (Next.js + Socket.IO) on `PORT` 10000; pre-deploy `prisma migrate deploy`; health `/api/health`; `CRAWL_BROWSER_ENABLED=1` |
| `aide-realtime-publisher` | Background worker | Outbox → Redis stream |
| `aide-redis` | Key Value, `noeviction` | Rate limits, realtime, BullMQ; private network only |
| `aide-jobs` | Background worker (commented out) | Enable only after `npm run worker:jobs` boots (below) |

Free instances sleep (cold starts, dropped WebSockets). The web service runs Chromium during crawls, so use standard (2 GB); starter (512 MB) risks out-of-memory restarts.

Verified locally (2026-09-24): Chromium inside the image (as user `node`) renders the Brandly SPA to 2,958 chars of text; the server boots on :10000 and `/api/health` reports the database ok; ~220 MB idle. Image is multi-stage: build with dev tools, prune, then a runtime stage with only the headless Chromium shell — 2.88 GB (was 4.7 GB). `playwright` is a production dependency because the crawler imports it at runtime.

When testing locally with `docker run --env-file`, remove quotes around values first: Docker keeps them literally (dotenv strips them).

The image builds without secrets (verified: `next build` and `prisma generate` pass with all secrets unset). Render passes service env vars as Docker build args; only `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` are declared, because they are inlined at build time.

## First deploy

1. Render → **New → Blueprint** → this repo. Fill every `sync: false` prompt:
   - `DATABASE_URL` (Neon pooled), `DIRECT_URL` (Neon direct).
   - `ACTIONS_CREDENTIALS_KEY`, `ACTIONS_IDENTITY_SECRET`: the **existing** values for this database. New values cannot decrypt stored credentials or verify customer identity JWTs.
   - `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `REALTIME_ALLOWED_ORIGINS`: the HTTPS origin (e.g. `https://aide-web.onrender.com`, or your custom domain).
   - Provider keys you use (OpenAI, Resend, Cloudinary, SafePay, Google, GitHub OAuth). Leave optional ones empty.
2. `AUTH_SECRET` and `REALTIME_TOKEN_SECRET` are generated. A new `AUTH_SECRET` signs everyone out once.
3. After the first deploy, seed admins from a laptop against the production database (`README.md` → Seed platform admins).
4. Smoke: login → agent chat streams → `/api/health` shows `"database": "ok"` → embed on an allowed origin → admin 404 for a normal user.

`NEXT_PUBLIC_*` values are baked in at build time: after changing one, trigger a new deploy.

## Known gaps

- **BullMQ worker does not boot yet.** `npm run worker:jobs` fails with `does not provide an export named 'BULLMQ_QUEUES'`: under `tsx`, plain `.js` files in `lib/` load as CommonJS. Same root cause as the local `test:f09`/`test:f12` harness failure. Until fixed, keep `BULLMQ_ENABLED` unset; email, billing and crawl run in-process.
- **Browser crawl** needs the Docker image. JavaScript-only sites (e.g. create-react-app) serve an empty shell to plain HTTP; only a rendered page has text. On a runtime without Chromium the Knowledge page now says so in plain language instead of "Playwright is not installed".
- **Use a separate database for development.** Point local `.env` at a Neon branch, not production.
