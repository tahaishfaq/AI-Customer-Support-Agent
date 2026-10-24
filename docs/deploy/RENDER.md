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
| `aide-web` | Web, **Docker** (starter, 512 MB) | HTTP-only `next start`; health `/api/health`; `CRAWL_BROWSER_ENABLED=1` |

Neon remains the database. Redis and the dedicated jobs worker are removed from
this deployment at the owner's request (2026-10-16, hosting cost reduction).

## HTTP-only configuration (2026-10-16)

Set `REDIS_ENABLED=0`, `BULLMQ_ENABLED=0`, `REALTIME_ENABLED=0`,
`REALTIME_DESK_ENABLED=0`, `REALTIME_EMBED_ENABLED=0`, and
`REALTIME_BILLING_ENABLED=0`. Remove Redis connection URLs and credentials from
Render and local `.env`. The Blueprint must not recreate `aide-jobs` or Redis.

`npm run dev` uses `next dev`; `npm run start` uses `next start`. On the existing
Render image, the Docker command explicitly starts Next.js directly so the old
`server.js` cannot require Redis. The custom `/readyz`, `/healthz`, `/metrics`,
and Socket.IO endpoints belong to that custom server and are absent in HTTP-only
mode; use `/api/health`, which should report `redis: disabled`.

Socket updates, realtime outbox publishing, and automatic worker sweeps stop.
Normal HTTP/SSE chat remains available. Redis caches/limits use their existing
non-Redis paths; limits are per process. Browser crawling remains enabled on the
web container. Full Redis/BullMQ source and dependency cleanup is deferred by the
owner; no schema or authority-path migration is part of this operational change.

Rollback requires provisioning Redis again, restoring credentials and rollout
flags, restoring the custom server command, and starting a worker. A deleted
Redis instance's ephemeral keys and queue history cannot be restored by toggling
flags. Verify health and a scoped queue/realtime probe before restoring traffic.

The owner selected Starter ($7/month, 512 MB) on 2026-10-16 to reduce cost.
Before the downgrade, the current HTTP-only instance used approximately 223 MiB
in Render's memory metrics. Chromium crawls remain enabled; monitor memory and
restart events. Roll back the plan to Standard if the workload needs more memory.
Free instances sleep and are not the selected plan.

### Starter crawl memory validation (2026-10-16)

Two isolated one-off jobs used the deployed image, Starter's actual 512 MiB
cgroup limit, a running Next.js production server, and the deployed browser
crawler against public Playwright documentation. No customer records were changed.
The harness runs a separate Node crawler process; its total memory includes that
process and is not an exact measurement of the normal request-handler path.

| Workload | Observed result |
| --- | --- |
| One 25-page sequential crawl | 25 indexed, zero failed; 60.1 seconds; 469.4 MiB sampled peak; zero OOM kills; all 16 health probes passed (maximum 193 ms) |
| Two concurrent crawls | Reached 512 MiB; Render confirmed the test job was OOM-killed |

Render evidence: successful job `job-db91cg67bikc73bkca50`; failed job
`job-db91bjvf3r2c73fongqg`; OOM event `evt-db91c0h7lnhs73fnbbmg` reports
`oomKilled.memoryLimit=512Mi`. Each job deprovisioned after exit; no worker
service was recreated. Starter passed this single-crawl workload with only about
43 MiB headroom, and failed concurrent crawling. There is no deployment-wide
single-crawl guard established by this test. It does not establish safety for
larger pages, multiple users, or sustained heavy traffic.

Separately, the base web service was suspended through a dashboard user action
during validation and was no longer suspended at the final status check. The
test harness did not suspend or resume it. Those state changes are distinct from
the isolated job's OOM failure.

Verified locally (2026-09-24): Chromium inside the image (as user `node`) renders the Brandly SPA to 2,958 chars of text; the server boots on :10000 and `/api/health` reports the database ok; ~220 MB idle. Image is multi-stage: build with dev tools, prune, then a runtime stage with only the headless Chromium shell — 2.88 GB (was 4.7 GB). `playwright` is a production dependency because the crawler imports it at runtime.

When testing locally with `docker run --env-file`, remove quotes around values first: Docker keeps them literally (dotenv strips them).

The image builds without secrets (verified: `next build` and `prisma generate` pass with all secrets unset). Render passes service env vars as Docker build args; only `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` are declared, because they are inlined at build time.

## First deploy

1. Render → **New → Blueprint** → this repo. Fill every `sync: false` prompt:
   - `DATABASE_URL` (Neon pooled), `DIRECT_URL` (Neon direct).
   - `ACTIONS_CREDENTIALS_KEY`, `ACTIONS_IDENTITY_SECRET`: the **existing** values for this database. New values cannot decrypt stored credentials or verify customer identity JWTs.
   - `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `REALTIME_ALLOWED_ORIGINS`: the HTTPS origin (e.g. `https://aide-web.onrender.com`, or your custom domain).
   - Provider keys you use (OpenAI, Resend, Cloudinary, SafePay, Google, GitHub OAuth). Leave optional ones empty.
2. Preserve the existing `AUTH_SECRET`; changing it signs everyone out.
3. After the first deploy, seed admins from a laptop against the production database (`README.md` → Seed platform admins).
4. Smoke: login → agent chat streams → `/api/health` shows `"database": "ok"` → embed on an allowed origin → admin 404 for a normal user.

`NEXT_PUBLIC_*` values are baked in at build time: after changing one, trigger a new deploy.

## Known gaps

- **Automatic sweeps are disabled.** There is no dedicated worker or Redis deployment. Re-enable only after a separate operational decision and verification.
- **Browser crawl** needs the Docker image (or another always-on Chromium host). Do not enable `CRAWL_BROWSER_ENABLED` on Vercel request handlers. JavaScript-only sites serve an empty shell to plain HTTP.
- **Use a separate database for development.** Point local `.env` at a Neon branch, not production.
