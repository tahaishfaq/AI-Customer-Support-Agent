# ADR 005 — Redis + BullMQ foundation

Status: Accepted (R0 + R3 + R5 scaffold)  
Date: 2026-09-17  
Scope: Shared Redis client, global rate limits, BullMQ worker stub.

## Context

Rate limits and some caches were process-local (`lib/rate-limit.js` Map). Realtime already uses `ioredis` via `REALTIME_REDIS_URL`. Enterprise plan: `docs/features/REDIS_BULLMQ_ENTERPRISE_PLAN.md`.

Redis/queues must not become PEP, confirmation, or identity authority.

## Decision

1. **R0** — `lib/redis/client.js` + `keys.js`; `REDIS_ENABLED`; health reports `redis`.
2. **R3** — `rateLimit` is async; prefers Redis fixed-window; **fail-open to memory** if Redis off/down (public chat availability). Auth OTP attempts still use memory `isRateLimited` pre-check + async increment.
3. **R5 scaffold** — `bullmq` + `lib/jobs/queues.js` + `workers/job-worker.mjs`. No email/crawl migration yet.
4. URL: `REDIS_URL` or fallback `REALTIME_REDIS_URL`.

## Non-goals (this slice)

OTP Redis primary (R1), profile cache (R2), crawl queue (R6), Socket adapter changes (already separate).

## Verification

`npm run test:redis-foundation` (no Redis required).  
`npm run test:otp-redis` (fake Redis; hash-only dual-write).  
`npm run test:profile-cache` (fake Redis; miss→fill→hit→invalidate).

## R1 follow-up (same ADR)

Password-reset OTP dual-writes SHA-256 hash to Redis HASH (`otp:reset:{userId}`) with attempt counter + cooldown key. Postgres `EmailToken` remains audit + consume fallback when Redis miss/disabled. VERIFY_EMAIL stays Postgres-primary.

## R2 follow-up (same ADR)

Public profile JSON at `profile:{userId}` (TTL 60–300s). Used by `/api/auth/me`, `requireFreshUser`, `requireAdmin`. Invalidate on suspend/verify/password-reset/restore. No passwordHash / secrets.

## R3 follow-up (same ADR)

Outbound semaphore uses Redis counter `sem:outbound:{agentId}` (Lua INCR/DECR) when `REDIS_ENABLED=1`; memory Map fallback otherwise. Confirm approve limits ride existing async `rateLimit`.

## R5 follow-up (same ADR)

`email` / `billing` workers process `ONBOARDING_DAY1_SWEEP` and `RENEWAL_REMINDER_SWEEP` with hour-bucketed idempotent `jobId`s. Cron scripts enqueue when `BULLMQ_ENABLED=1` (fallback `--inline`). Never put raw OTP in job payloads. Crawl/knowledge remain scaffold processors.

## R4 follow-up (same ADR)

GET action results cache at `action:get:{digest}` (TTL from `ACTION_GET_CACHE_TTL_MS`, default 30s). Memory fallback when Redis off. Body capped at 32KB; errors and WRITE paths not cached.

## R6 follow-up (same ADR)

Crawl queue job `RUN_SITE_CRAWL` with idempotent `crawl:site:{siteCrawlJobId}`. Per-agent Redis lock `lock:crawl:{agentId}`. Public ping enqueues when `BULLMQ_ENABLED=1`, else keeps `after(runCrawlJob)`. Knowledge queue remains scaffold until F10.

## R7 follow-up (same ADR)

Socket.IO Redis adapter already in `realtime-gateway/attach.js`. Gateway config falls back to `REDIS_URL` / `REDIS_USERNAME` / `REDIS_PASSWORD`. Presence/typing stay ephemeral (not Redis keys). Connection budget documented in `REALTIME_ENVIRONMENT_CONTRACT.md`.
