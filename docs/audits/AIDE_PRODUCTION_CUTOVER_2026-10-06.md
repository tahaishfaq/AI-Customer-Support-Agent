# Aide production cutover — live acceptance

Date: 2026-10-06  
No architecture rewrite. Evidence only.

## Verdict

| Gate | Result |
| --- | --- |
| READY FOR DESIGN PARTNERS | **NOT READY** on the live coral host |
| READY FOR PUBLIC BETA | **NOT READY** |
| Overall | **NOT READY** |

Blocker: production web is Vercel serverless with Redis **disabled**. Shared rate limits, crawl lock, BullMQ, independent recrawl, and Chromium SPA crawl cannot run on that topology.

Intended capable topology exists in `render.yaml` (always-on Docker + Redis + optional jobs worker) but is **not** the live coral alias.

---

## 3. Production topology (actual)

| Role | Recorded |
| --- | --- |
| Web app | **Vercel** serverless (`server: Vercel`, `x-matched-path: /api/health`, region sin1). Domain: `https://ai-customer-support-agent-coral.vercel.app` |
| Job worker | **Not deployed** on coral. `render.yaml` `aide-jobs` is commented out |
| Crawler Chromium | **Not on coral.** Dockerfile sets `CRAWL_BROWSER_ENABLED=1` for Render Docker; Vercel request path is unsuitable |
| Database | **Neon PostgreSQL** (`/api/health` `database: ok`; local `prisma migrate status`: schema up to date) |
| Redis | URL present in local env (Upstash `rediss`). **Live coral health: `redis: disabled`** |
| Queue | BullMQ in code; **not running** without `BULLMQ_ENABLED=1` + worker process |
| Realtime | `server.js` + Socket.IO designed for always-on Node. Coral is Vercel functions, not that process |

Supports persistent queue consumers / recrawl sweep / Playwright / Socket.IO always-on?

| Need | Coral Vercel | Render Docker blueprint |
| --- | --- | --- |
| Persistent worker | **FAIL** | Designed, jobs service commented |
| Recrawl without HTTP | **FAIL** | Needs `aide-jobs` enabled |
| Chromium | **FAIL** (do not run in serverless) | **Intended** (web image includes Chromium) |
| Socket.IO always-on | **FAIL** / degraded | **Intended** (`server.js`) |

---

## 4. Preflight

Command: `node scripts/production-preflight.js --production` against **local `.env`** (not Vercel dashboard).

Local `.env` is **not** a production origin config (`AUTH_URL` / `NEXT_PUBLIC_APP_URL` are localhost HTTP; `REDIS_ENABLED` unset).

| VARIABLE | Status | Blocker |
| --- | --- | --- |
| DATABASE_URL | PRESENT | No |
| DIRECT_URL | PRESENT | No |
| AUTH_SECRET | PRESENT | No |
| OPENAI_API_KEY | PRESENT | No |
| ACTIONS_IDENTITY_SECRET | PRESENT | No |
| ACTIONS_CREDENTIALS_KEY | PRESENT | No |
| SAFEPAY_API_KEY | PRESENT | No |
| SAFEPAY_WEBHOOK_SECRET | PRESENT | No |
| RESEND_API_KEY | PRESENT | No |
| REALTIME_REDIS_URL / REDIS_URL | PRESENT | No (URL only) |
| REALTIME_TOKEN_SECRET | PRESENT | No |
| AUTH_URL | INVALID (not https) | **YES** for calling this env production |
| NEXT_PUBLIC_APP_URL | INVALID (not https) | **YES** |
| REDIS_ENABLED | INVALID (must be 1 in production) | **YES** |
| REALTIME_URL | MISSING optional | No |
| CRAWL_BROWSER_ENABLED (local) | PRESENT (`1`) | **YES** if applied to Vercel |
| BULLMQ_ENABLED (local) | unset | **YES** for independent recrawl |
| Coral REDIS_ENABLED | disabled (`/api/health`) | **YES** |

Live coral `AUTH_URL` / Vercel env values were **not** dumped (no secret print). HTTPS on the coral hostname itself: **PASS** (health over https).

---

## 5. Database

| Check | Result |
| --- | --- |
| Connectivity | PASS — coral health `database: ok`; Prisma migrate status connected |
| `prisma migrate status` | PASS — **Database schema is up to date** (83 migrations). `migrate deploy` not re-run |
| AgentAction.protocol | PASS |
| SiteCrawlJob / SiteCrawlPage + discovered/indexed/coverageJson | PASS |
| KnowledgeDocument | PASS |
| ActionConfirmation, WriteIdempotencyRecord, DurableWriteOperation | PASS |
| Destructive SQL | NOT_APPLICABLE (not run) |

---

## 6. Redis + BullMQ

| Test | Result | Scope |
| --- | --- | --- |
| Coral health redis | **FAIL** — `"redis":"disabled"` | production web |
| Local Upstash PING / SET+TTL / INCR | PASS | laptop → Upstash, `REDIS_ENABLED` not required for raw client |
| Crawl lock overlap + release | PASS | `REDIS_ENABLED=1` on laptop against Upstash |
| Rate-limit shared on coral | **FAIL** — flag off → memory fallback on Vercel instances |
| Job enqueue + worker consume + retry + failed state | **FAIL** / EXTERNAL_BLOCKED — no production worker |
| Restart web, shared state valid | **FAIL** — Redis disabled on coral |
| Duplicate crawl suppression (prod) | **FAIL** without Redis lock on coral |

Per instruction: production Redis unavailable / memory fallback = **FAIL**.

---

## 7. Worker

| Check | Result |
| --- | --- |
| `BULLMQ_QUEUES` named export | PASS (RENDER.md stale claim corrected) |
| Production `worker:jobs` process | FAIL — not on coral |
| Recrawl without widget/dashboard | FAIL on coral (sweep lives in job worker interval) |

---

## 8. Chromium / Playwright

| Check | Result |
| --- | --- |
| This laptop Playwright launch | **FAIL** — Chromium executable missing |
| Coral / Vercel Chromium | **FAIL** — serverless, not the Docker image |
| Render Docker image | NOT_APPLICABLE this pass (not the live alias) |
| SPA-ready on production | **FAIL** (browser never launched in prod) |

---

## 9–13. Live product flows

| Item | Result |
| --- | --- |
| Owner static site crawl on coral UI | EXTERNAL_BLOCKED — not exercised (no signed-in production session this pass) |
| SPA CSR live crawl + Studio retrieval | **FAIL** / EXTERNAL_BLOCKED — Chromium missing locally and on coral |
| Browser nav to private/metadata/file | PASS (unit: `isBlockedBrowserTarget` in `test:crawl-spa-detect`) — not a live Playwright navigation |
| Crawl failure keeps old knowledge | NOT_APPLICABLE this pass (code path: failed job does not `syncCrawlKnowledge`) |
| Scheduled recrawl independent | FAIL on coral topology |

---

## External systems

| System | Result | Evidence |
| --- | --- | --- |
| OpenAI | PASS | `GET /v1/models/gpt-4o-mini` → 200 with configured key |
| Hosted web search | EXTERNAL_BLOCKED | not invoked |
| Resend domain / outbound to arbitrary recipients | EXTERNAL_BLOCKED | earlier local server: Resend 403 test-mode recipient restriction |
| Email inbound | EXTERNAL_BLOCKED | not invoked |
| SafePay webhook | EXTERNAL_BLOCKED | not delivered this pass |
| Billing entitlement | EXTERNAL_BLOCKED | not a live checkout this pass |
| Confirmation WRITE once | EXTERNAL_BLOCKED | not a live widget confirm this pass |
| Handoff / realtime owner reply | EXTERNAL_BLOCKED | coral is not `server.js`; Socket.IO always-on unproven on Vercel |

---

## Go-live to flip design-partner READY

1. Stop treating Vercel coral as the crawler/realtime/Redis host, **or** put Redis+worker+Chromium on always-on processes (Render Docker blueprint) and point the public alias there.
2. Vercel/Render: `REDIS_ENABLED=1`, real Redis URL, `BULLMQ_ENABLED=1`, `npm run worker:jobs`.
3. `CRAWL_BROWSER_ENABLED=1` **only** on the Chromium Docker/worker, never on Vercel serverless.
4. `AUTH_URL` + `NEXT_PUBLIC_APP_URL` = HTTPS production origin (not localhost).
5. Re-run coral `/api/health` until `redis: ok`.
6. Then: owned static crawl, owned SPA crawl, Studio retrieval, WRITE confirm, Inbox handoff.

## No-change confirmation

PEP, orchestrator, Auth.js, Prisma, confirmation, idempotency, GraphQL stored ops, XML safety, crawler design were not rewritten. Only `docs/deploy/RENDER.md` was corrected for the worker export fact.
