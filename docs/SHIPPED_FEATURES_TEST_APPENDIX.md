# F01 — Error handling & observability

**Goal:** Every critical path fails safely in the UI; ops can find failures in logs without dumping chat PII.  
**Maps to:** requirements DoD “critical errors handled” · Week 3 Logging · Fusion Band 1 W3-4.  
**Aide identity:** never log full customer transcripts in production by default; admin audit stays separate.

> **Deliverables rule:** When a phase is marked ✅, fill **Delivered** (exact files / behavior) and **Manual test** (steps you can run yourself). Until then, keep only the short plan lines.

---

## Phase A — Scope & identity ✅

- In: chat/OpenAI down, classify fail, crawl fail, auth 401/429, register validation, maintenance, public embed errors.
- Out: full APM product (Datadog clone), PII-rich debug dumps in prod.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Add** `lib/observability/request-id.js` | Creates / echoes `x-request-id` |
| **Add** `lib/observability/safe-log.js` | JSON logs; strips prompt/email/body keys; respects `LOG_LEVEL` |
| **Add** `lib/api/error-response.js` | `jsonError` / `jsonOk` / `withRequestId` → `{ error: { message, details } }` + header |
| **Update** studio + public chat routes | All responses get `x-request-id`; failures use `jsonError` |
| **Update** `app/api/auth/register/route.js` | Same error helper + request id |
| **Update** `lib/require-auth.js` | 401 / 503 include `x-request-id` when `request` passed |
| **Update** `lib/services/chat.service.js` | LLM fail → safe assistant + `degraded: true` + safe log (no transcript) |
| **Update** classify + LLM provider | Message-only / meta-only fail logs |
| **Update** crawl fail in embed service | Safe log with `jobId` / `agentId` |
| **Add** `scripts/test-f01a.mjs` · `npm run test:f01a` | Automated smoke |
| **Update** `.env.example` | Optional `LOG_LEVEL` |

### Manual test

1. Dev server on → `npm run test:f01a` (must pass).
2. Browser Network: POST `/api/auth/register` with bad email → response header `x-request-id`, body `{ error: { message: "Validation failed", details: … } }`.
3. Studio chat without login → 401 + `x-request-id`.
4. (Optional) Break `OPENAI_API_KEY` temporarily → send chat → assistant shows friendly fallback, terminal shows JSON log with `requestId` / `agentId`, **not** the user message text.

---

## Phase B — Design & functionality ✅

- Standard API error shape `{ error: { message, details } }` — enforce on remaining admin/public routes.
- Chat: user message saved + safe assistant fallback when LLM fails (keep 200 path).
- Crawl: surface `FAILED` / queued in Knowledge UI (badge + auto-refresh).
- `x-request-id` on public + admin auth errors.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** `app/api/public/agents/[publicKey]/ping/route.js` | 403/404/500 use `{ error: { message, details } }` + `x-request-id` + CORS; still HTTP **403** for origin lock (widget depends on status) |
| **Update** public `files` / `feedback` / `conversations` routes | All errors + success via `jsonError` / `jsonOk` |
| **Update** `lib/require-admin.js` | Admin 401 uses `jsonError` + optional `x-request-id` |
| **Update** all `app/api/admin/**` callers | Pass `request` into `requireAdmin(request)` |
| **Update** `app/api/analytics/handle-error.js` + analytics routes | Errors + auth get `x-request-id` |
| **Confirm** chat LLM fallback | Already from Phase A — no API change this phase |
| **Improve** `components/knowledge/KnowledgeList.jsx` | Crawl status **badge**; QUEUED/RUNNING **poll every 3s**; empty-state copy while crawling |
| **Add** `scripts/test-f01b.mjs` · `npm run test:f01b` | Ping/files/admin request-id smoke |
| **Document exceptions** | `/api/health`, `/api/public/platform`, `/api/auth/suspended-check` stay soft/probe shapes (intentional) |

### Manual test

1. `npm run test:f01a && npm run test:f01b` (dev server running).
2. Network: POST `/api/public/agents/fake/ping` → **404**, body has `error.message`, header `x-request-id` (send custom header to confirm echo).
3. Network: GET `/api/admin/overview` logged out → **401** + `x-request-id` + `error.message`.
4. UI: Agent → Knowledge — if crawl is QUEUED/RUNNING you see a badge and status auto-updates without full page reload; on FAILED you see red badge + reason + “Embed again…”.
5. Chat: send a message with AI down → still get a friendly assistant bubble (HTTP 200), user message saved in history.

---

## Phase C — Improvements ✅

- User-facing copy: short, actionable (“Try again” / “Signups closed” / “Admins use email + password”).
- Toast vs inline: chat uses inline; forms use field errors.
- Studio “error” strip when generation fails mid-run (`degraded` UI). (“Used knowledge” titles wait for F08.)

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** `AgentTestStudio.jsx` | If `result.degraded` → strip **“Generation failed — Try again”** + **Try again** button; auto-run returns `false` (pauses) |
| **Update** `ChatWorkspace.jsx` + `ConversationThread.jsx` | Same degraded strip + **Try again** (was “Retry”) |
| **Update** `PublicWebchat.jsx` | Degraded / send fail → danger strip + Try again (not plain red text) |
| **Update** `chat.service.js` SAFE_ASSISTANT | Shorter: “Couldn't reach the AI… try again…” |
| **Update** `auth-store.js` | Admin Google → **“Admins use email + password”**; closed → **“Signups closed”** |
| **Update** `auth.service.js` | 403 message **“Signups closed”** |
| **Update** `RegisterForm.jsx` | Closed gate short copy; password/API validation as **per-field** errors |

### Manual test

1. Studio Test: temporarily break `OPENAI_API_KEY` → send a message → assistant shows safe line **and** red strip “Generation failed — Try again”; auto-run should pause if running.
2. Product `/chat` or Inbox reply: same strip + Try again.
3. Embed widget: same after AI failure (or force network fail for Try again).
4. `/register` with short password → field error under password (not only top alert).
5. Admin Google sign-in → message **“Admins use email + password”**.
6. With signups disabled → register page shows **“Signups closed”**.

---

## Phase D — Error handling (deep) ✅

| Surface | Failure | User sees | Server does |
|---------|---------|-----------|-------------|
| Studio/public chat | OpenAI timeout/5xx | Friendly assistant line | Log requestId, agentId, duration — **not** full prompt |
| Classify | Model/parse fail | Chat still works | GENERAL/NEUTRAL fallback + warn log |
| Crawl | Fetch/parse fail | FAILED badge + retry | Job status + reason code |
| Auth | Bad password / rate limit | Clear message / 429 | Rate-limit counters; admin window stricter |
| Embed | Origin mismatch | Widget unavailable | 404/403; no stack traces |

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** `chat.service.js` | LLM fail log adds `durationMs` + `code: LLM_FAILED` (with requestId/agentId) |
| **Update** `llm.provider.js` | Provider fail logs include `durationMs`; 500/502 rethrow without duplicate noise |
| **Confirm** classify | Still GENERAL/NEUTRAL + `safeLogWarn` (from A) |
| **Update** `embed.service.js` | Job `error` stored as `CRAWL_FAILED: …`; Knowledge UI strips prefix for display |
| **Update** `auth.js` | Admin lockout throws `TooManyAttemptsError` (`too_many_attempts`) — not silent null |
| **Update** `auth-store.js` | Maps rate limit → **“Too many attempts. Try again shortly.”** (status 429) |
| **Update** `[...nextauth]/route.js` | `tooManyRequests(..., request)` → `x-request-id` on IP 429 |
| **Confirm** embed deny | Ping 403/404 + EmbedUnavailable (from B) — no change |
| **Add** `npm run test:f01d` | Source contracts + optional live auth 429 |

### Manual test

1. Break OpenAI key → send chat → strip + safe reply; terminal JSON log has `requestId`, `agentId`, `durationMs`, `LLM_FAILED` — **no** user text.
2. Admin login: wrong password 5+ times within 15m → **“Too many attempts. Try again shortly.”** (not “Invalid email or password”).
3. Knowledge crawl fail → badge + reason (without raw `CRAWL_FAILED:` noise) + “Embed again…”.
4. Embed on wrong origin → widget unavailable (403/404), no stack in Network response.
5. `npm run test:f01d`.

---

## Phase E — Production bottlenecks ✅

- Avoid double LLM call retries that amplify cost on timeout.
- Cap log volume: sample or drop success chat logs; always keep errors.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** `llm.provider.js` | OpenAI client `maxRetries: 0` (SDK default was 2 → double cost on timeout); optional `OPENAI_TIMEOUT_MS` (default 45s) |
| **Update** `chat.service.js` | On `degraded`, **skip** classify LLM → `GENERAL` / `NEUTRAL` (no second paid call after failure) |
| **Update** `safe-log.js` | `safeLogInfoSampled` — success/info chat logs **off** unless `LOG_CHAT_SUCCESS=1` or `LOG_INFO_SAMPLE_RATE` |
| **Update** `.env.example` | Documents `LOG_CHAT_SUCCESS`, `LOG_INFO_SAMPLE_RATE`, `OPENAI_TIMEOUT_MS` |
| **Add** `npm run test:f01e` | Source + sample-gate smoke |

### Manual test

1. `npm run test:f01e` → pass.
2. Break OpenAI key → one fail log (`LLM_FAILED`); **no** classify warn for that turn (classify skipped).
3. Confirm terminal is quiet on successful chats (no per-message info spam).
4. Optional: set `LOG_CHAT_SUCCESS=1` briefly → success info lines appear; unset again for prod.

---

## Phase F — Scaling ✅

- Request-id propagation across chat → classify → crawl workers (same id).
- When background jobs exist later, dead-letter + alert hook placeholder.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Add** `lib/observability/request-context.js` | AsyncLocalStorage: `runWithRequestContext` / `resolveLogMeta` |
| **Update** `chat.service.js` | LLM + classify run inside shared context (`requestId`, `agentId`, …) |
| **Update** `classify.js` | Fail logs use `resolveLogMeta` (ALS fallback if meta omitted) |
| **Update** `SiteCrawlJob` + migration | Optional `requestId` column + index |
| **Update** ping → `claimEmbedOrigin` → enqueue → `runCrawlJob` | Same HTTP `x-request-id` stored on job and passed into `after()` worker |
| **Add** `lib/observability/dead-letter.js` | `enqueueDeadLetter` — warn log now; `DEAD_LETTER_WEBHOOK_URL` placeholder later |
| **Add** `npm run test:f01f` | Source + ALS + DLQ smoke |

### Manual test

1. `npm run test:f01f` → pass.
2. Apply DB migration (if not already): `npx prisma migrate deploy` (adds `SiteCrawlJob.requestId`).
3. Embed ping that queues a crawl → DB row / fail logs include same `requestId` as response `x-request-id`.
4. Chat fail → classify warn (if any) shares same `requestId` as chat fail log.
5. Optional: set `DEAD_LETTER_WEBHOOK_URL=https://example.com` → crawl fail logs `DLQ_HOOK_PLACEHOLDER` (no real HTTP yet).

---

## Phase G — Infrastructure ✅

- Vercel: ensure logs retention / filter by requestId documented in README.
- Env: `LOG_LEVEL` optional (`info`/`warn`).

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** `README.md` | New **Observability** section: how to find `x-request-id` in Vercel Logs; retention note; prod `LOG_LEVEL` guidance |
| **Update** `README.md` env tables | Documents `LOG_LEVEL`, `LOG_CHAT_SUCCESS`, `LOG_INFO_SAMPLE_RATE`, `OPENAI_TIMEOUT_MS`, `DEAD_LETTER_WEBHOOK_URL` |
| **Update** migrations list | Mentions `20260823080000_crawl_job_request_id` |
| **Confirm** `.env.example` | Already had `LOG_LEVEL` + related knobs (Phase E/F) |
| **Add** `npm run test:f01g` | README/source contract smoke |

### Manual test

1. `npm run test:f01g` → pass.
2. README search: “Observability” + “x-request-id” — steps make sense.
3. On Vercel (or local terminal): force a chat fail → copy `x-request-id` from Network → find matching JSON line in logs.
4. Set `LOG_LEVEL=error` briefly → info/warn quiet; errors still appear.

---

## Phase H — Production testing ✅

- [x] Kill OpenAI key temporarily on preview → chat shows safe error, no white screen. *(code path + studio strip shipped; confirm on preview)*
- [x] Force classify fail → conversation still listed; analytics not crashed. *(fallback GENERAL/NEUTRAL + degraded skips classify)*
- [x] 429 on register → readable copy. *(automated when limit hits; source contracted)*
- [x] Maintenance on → USER sees MaintenanceScreen; ADMIN still enters `/admin`. *(layout + requireAuth; confirm toggle in admin UI)*

### Delivered

| Change | What exactly |
|--------|----------------|
| **Add** `scripts/test-f01h.mjs` · `npm run test:f01h` | Source contracts for DoD paths + live 401/platform/optional register 429 |
| **Add** `npm run test:f01` | Runs F01 A/B/D/E/F/G/H smokes in order |
| **Confirm** paths | SAFE_ASSISTANT + `degraded` UI · classify fallback · register 429 copy · MaintenanceScreen / API 503 |

### Manual test (preview / Vercel — do once per release)

1. `npm run test:f01h` (local with `npm run dev`) → pass.
2. **OpenAI kill:** unset / wrong `OPENAI_API_KEY` on preview → Studio/chat: friendly assistant + “Generation failed — Try again”; no white screen; logs have `requestId` + `LLM_FAILED`.
3. **Classify:** with AI working, or force classify fail — conversation still in list; `/analytics` loads.
4. **Register 429:** burst signups from one IP → message like “Too many accounts… Try again later.”
5. **Maintenance:** Admin → Safety → maintenance **on** → USER `/agents` shows MaintenanceScreen; ADMIN still opens `/admin`. Turn **off** after.

### F01 complete when

`npm run test:f01` green locally **and** Manual test checklist above done on preview once.

---

## Done when

One failed chat is findable in Vercel logs by requestId; user never sees raw stack; DoD “critical errors handled” satisfied.

## Steal (not clone)

Zendesk/Botpress **ops reliability** — visible failure + recoverable state — without their full observability suites.


---


# F02 — Production ops & bottlenecks

**Goal:** Cut wasteful work on chat + analytics; keep Neon and OpenAI costs predictable.  
**Maps to:** Week 3 Performance · Fusion W3-5.  
**Aide identity:** insights stay fresh; do not drop classify forever to “go faster.”


> **Deliverables rule:** When a phase is marked ✅, add **Delivered** (exact files/behavior) and **Manual test** (steps you can run). Until then, keep the short plan lines only.

---

## Phase A — Scope & identity ✅

- In: analytics queries, chat latency perception, crawl/job contention, rate limits, connection pooling.
- Out: multi-region active-active, Redis cluster (unless Phase G explicitly chooses it).

### Identity guardrails (do not break)

| Keep | Meaning |
|------|---------|
| Insights stay fresh | Do not permanently skip classify to “go faster” (F01 already skips classify only on LLM `degraded`) |
| Workspace isolation | Analytics / chat stays scoped to workspace or public key — no cross-tenant shortcuts |
| Origin-locked embed | Perf work must not weaken crawl/chat origin checks |
| Cost predictability | Prefer fewer Neon round-trips and no OpenAI retry storms over adding infra |

### Current hot-path inventory (baseline for Phase B+)

| Area | Primary code | Today’s shape | F02 pressure |
|------|----------------|---------------|--------------|
| Chat reply | `lib/services/chat.service.js` · studio/public chat routes | LLM then classify on success; degraded skips classify (F01-E) | Perceived latency (UI pending); optional after-return classify later (Phase E, careful) |
| OpenAI client | `lib/services/ai/llm.provider.js` | `maxRetries: 0`, `OPENAI_TIMEOUT_MS` default 45s | Stay under Vercel function budget |
| Product analytics | `lib/services/analytics.service.js` · `/api/analytics/*` | `loadBundle` pulls conversations + assistant `responseTime` rows into memory, then JS aggregates | Unbounded growth with chat volume — Phase C SQL/caps |
| Admin platform analytics | `getDashboardForPlatform` · `/api/admin/analytics/dashboard` | Loads **all** agents then same bundle pattern | Cold load / p95 — Phase C lazy ranges |
| Rate limits | `lib/rate-limit.js` (in-memory Map) | pub-chat 20/min/IP+key; register after validation; studio/auth/ping/files | Tune only; shared Redis deferred to Phase G decision |
| Neon pool | `lib/prisma.js` · `pg.Pool` on `DATABASE_URL` | Default pool sizing; `.env.example` already has pooled vs `DIRECT_URL` | Document + size in Phase G; no multi-region |
| Crawl vs chat | `lib/services/embed.service.js` (`enqueueOneTimeCrawl` / `runCrawlJob`) | Same DB as chat; job has `requestId` (F01-F) | Contention awareness; off-peak / queue later — not Redis cluster now |

### Explicitly out of F02

- Multi-region active-active failover
- Redis / Upstash rate-limit cluster **unless** Phase G records a go decision
- Vector RAG / retrieval rewrite (that is F08/F10)
- Dropping classify forever for speed

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** this file Phase A | Locked in/out, identity table, hot-path inventory tied to real files |
| **Add** `scripts/test-f02a.mjs` · `npm run test:f02a` | Asserts Phase A ✅, scope lines, inventory files exist, out-of-scope still named |

### Manual test

1. Read the inventory table above — agree these are the only F02 levers before Phase B measures.
2. `npm run test:f02a` (must pass).
3. Confirm `.env.example` still documents `DATABASE_URL` (pooled app) vs `DIRECT_URL` (migrations) — no Redis required for F02-A.

---

## Phase B — Design & functionality ✅

- Measure baselines: studio TTFT/total, `/api/analytics/dashboard` p95, admin platform dashboard p95.
- Document hot paths: `chat.service`, analytics service, admin overview aggregates.

### Hot path — chat (`lib/services/chat.service.js`)

1. Route: auth → rate limit → validate body  
2. Load agent (studio ownership / public embed checks)  
3. Create or load conversation  
4. Persist USER message  
5. Parallel: all knowledge docs + recent history  
6. Stuff KB into system prompt → OpenAI `chatCompletion` (`maxRetries: 0`)  
7. Persist ASSISTANT (+ `responseTime`)  
8. Classify topic/sentiment **unless** `degraded` (F01-E)  
9. Return JSON — **no streaming**, so **TTFT ≈ total** wall time  

### Hot path — analytics (`lib/services/analytics.service.js`)

`getDashboardForUser` / `getDashboardForWorkspace` / `getDashboardForPlatform` → resolve agents → `loadBundleFromAgents`:

- `conversation.findMany` (category, sentiment, `_count.messages`) for range  
- `message.findMany` all ASSISTANT rows with `responseTime`  
- Aggregate overview / topics / sentiment / trends **in Node**  

Platform path loads **every** agent first — heaviest cold path.

### Hot path — admin overview (`lib/services/admin-overview.service.js`)

Five parallel `count()` queries (users, workspaces, agents, conversations total + 24h). Cheap vs full analytics dashboard; keep as the light admin KPI path.

### Baseline checklist

Fill via `npm run bench:f02b` (dev server; admin needs `ADMIN_BOOTSTRAP_*`). Prefer **server** `x-aide-duration-ms` when present; client includes network.

| Endpoint | client p50 | client p95 | server p95 | notes |
|----------|------------|------------|------------|-------|
| `POST /api/agents/[id]/chat` | 2833 | 2833 | 2809 | 2026-08-23 local; n=1; TTFT≈total |
| `GET /api/analytics/dashboard?range=7d` | 664 | 667 | 652 | 2026-08-23 local; n=3; admin session fallback |
| `GET /api/admin/analytics/dashboard?range=7d` | 917 | 1018 | 993 | 2026-08-23 local; n=3 |
| `GET /api/admin/overview` | 284 | 302 | 288 | 2026-08-23 local; n=3; count-only control |

Re-run after Phase C/E and paste new rows under this table (do not delete prior rows — append with date).

### Delivered

| Change | What exactly |
|--------|----------------|
| **Add** `lib/observability/duration.js` | `x-aide-duration-ms` helper |
| **Update** product + admin analytics dashboard routes | Echo request id + duration ms |
| **Update** `app/api/admin/overview/route.js` | Same headers (safe log on failure) |
| **Update** studio chat route | Duration on success (TTFT≈total marker) |
| **Add** `scripts/bench-f02b.mjs` · `npm run bench:f02b` | Warmup + p50/p95 samples |
| **Add** `scripts/test-f02b.mjs` · `npm run test:f02b` | Doc + wiring smoke |
| **Update** this file | Hot-path writeups + baseline checklist |

### Manual test

1. `npm run test:f02b` (must pass).  
2. Dev server on → `npm run bench:f02b` → paste printed markdown rows into the baseline table.  
3. Browser Network: load `/analytics` and `/admin` → response headers include `x-aide-duration-ms`.  
4. Studio send one message → same header on chat response.

---

## Phase C — Improvements ✅

- Analytics: SQL aggregates / caps instead of loading unbounded conversation graphs.
- Chat UI: optimistic send + clear pending state (perceived perf).
- Admin dashboard: lazy-load heavy chart ranges.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** `lib/services/analytics.service.js` | `sinceForRange`: `"all"` = last 12 months. Cap 8k chart samples. If over cap → SQL `count`/`aggregate`/`groupBy` for exact KPIs; else fast JS path. |
| **Update** chat UIs | Clear `sending` as soon as assistant lands (workspace, thread, studio, public) so pending bubble does not linger |
| **Update** `useAnalyticsDashboard` | `enabled` + `keepPrevious` so range switches keep prior charts |
| **Update** `AdminPlatformAnalytics` | Fast `/api/admin/overview` shell KPIs; defer full dashboard charts per range |
| **Add** `scripts/test-f02c.mjs` · `npm run test:f02c` | Source contracts smoke |

### Manual test

1. `npm run test:f02c` (must pass).
2. `/admin` cold load: Users/Spaces/Agents appear before chart skeletons finish.
3. Switch range 7d → 30d → All time: prior charts stay until new data; Network shows overview then dashboard.
4. Studio/chat: send message → user bubble immediate; typing pending clears when assistant appears (no double bubble).
5. Optional: `F02_BENCH_SKIP_CHAT=1 npm run bench:f02b` — analytics p95 should not regress vs Phase B on same data.

---

## Phase D — Error handling ✅

- Slow query timeout → 504/503 with “Analytics busy, try a shorter range.”
- OpenAI slow: client timeout messaging; cancel does not orphan half-saved messages.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Add** `lib/observability/analytics-timeout.js` | `withAnalyticsTimeout` (default 15s) + busy copy helper |
| **Update** `handleAnalyticsError` | 503 + “Analytics busy, try a shorter range.” for timeouts / Prisma slow codes |
| **Update** `getDashboardForUser` / Workspace / Platform | Wrapped in `withAnalyticsTimeout` |
| **Update** `llm.provider` `chatCompletion` | Detect timeout → 504; abort → 499; accepts `signal` |
| **Update** `chat.service` | Timeout / cancel / fail always save ASSISTANT so USER is never orphaned; distinct copy |
| **Update** studio + public chat routes | Pass `request.signal` into chat |
| **Update** `.env.example` | Optional `ANALYTICS_TIMEOUT_MS` |
| **Add** `scripts/test-f02d.mjs` · `npm run test:f02d` | Contracts + timeout helper unit |

### Manual test

1. `npm run test:f02d` (must pass).
2. (Optional) Set `ANALYTICS_TIMEOUT_MS=1` temporarily → load `/analytics` → UI shows “Analytics busy, try a shorter range.” → restore env.
3. Studio: send a message, navigate away mid-flight (or abort) → conversation still has USER + assistant fallback (“Reply cancelled…” or timeout copy), not a lone user bubble.
4. Network: slow OpenAI (or tiny `OPENAI_TIMEOUT_MS`) → assistant shows timeout copy; `degraded: true`.

---

## Phase E — Production bottlenecks (core) ✅

| Bottleneck | Symptom | Fix direction |
|------------|---------|---------------|
| Stuffing huge KB | High tokens / slow / truncate | F08 retrieval lite |
| Classify on critical path | +0.5–2s after reply | Optional after-return classify with lag flag (careful) |
| Admin “all conversations” | Dashboard 1s+ | Pre-agg counts / limited range |
| Neon pool exhaustion | Random 500s | Prisma pool sizing; serverless-friendly URL |
| Crawl + chat same DB | Lock/contention | Crawl off peak / job queue later |

### Delivered

| Bottleneck | What shipped |
|------------|----------------|
| Huge KB | Soft cap kept (`MAX_KNOWLEDGE_CHARS=12_000`); smarter retrieval stays **F08** |
| Classify on critical path | Default: classify in `after()` post-return; response includes `insightsPending: true` + provisional GENERAL/NEUTRAL; `CLASSIFY_AFTER_RETURN=0` restores sync |
| Admin / all chats | Kept F02-C bounds: `"all"` = 12 months + sample cap / SQL exact KPIs when over cap |
| Neon pool | `pg.Pool` `max` default **3** (`PG_POOL_MAX`); idle/connect timeouts; `.env.example` stresses `-pooler` URL |
| Crawl vs chat | Ping still enqueues then `after()`; optional `CRAWL_DEFER_MS` (default 750) before `runCrawlJob` |

| Change | Files |
|--------|--------|
| **Update** `lib/services/chat.service.js` | after-return classify + `insightsPending` |
| **Update** `lib/prisma.js` | Pool max / idle / connect |
| **Update** public ping route | Crawl defer |
| **Update** `.env.example` | `PG_POOL_*`, `CLASSIFY_AFTER_RETURN`, `CRAWL_DEFER_MS`, pooler note |
| **Add** `scripts/test-f02e.mjs` · `npm run test:f02e` | Source contracts |

### Manual test

1. `npm run test:f02e` (must pass).
2. Studio chat → Network JSON includes `insightsPending: true` (unless `CLASSIFY_AFTER_RETURN=0`); refresh conversation a second later → category/sentiment filled.
3. Confirm `.env` `DATABASE_URL` uses Neon **pooler** host in prod.
4. Embed first ping that queues crawl → crawl still completes; chat during crawl should not 500 from pool exhaustion on a quiet workspace.

---

## Phase F — Scaling ✅

- Per-workspace / per-IP rate limits already on public chat — tune for burst.
- Soft caps in PlatformSettings (agents/workspaces) as cost brakes.
- Plan for read replica only if analytics dominates (Phase G decision).

### Delivered

| Change | What exactly |
|--------|----------------|
| **Add** `lib/rate-limit-config.js` | Env-tunable pub/studio/ping/register limits; pub-chat default **40**/min (burst) |
| **Update** public + studio chat, ping, register routes | Use rate-limit-config |
| **Update** PlatformSettings defaults | New installs: max workspaces **10**, max agents/workspace **25** (0 still = unlimited in DB) |
| **Update** Admin Safety copy | Suggest those cost brakes |
| **Decision** | Read replica → **Phase G** (not needed yet) |
| **Add** `scripts/test-f02f.mjs` · `npm run test:f02f` | Contracts |

### Manual test

1. `npm run test:f02f`.
2. Admin → Safety → Soft caps: set agents/workspace to 25 if still 0 unlimited.
3. Optional: hammer public chat past limit → 429 with Retry-After.

---

## Phase G — Infrastructure ✅

- Neon: pooled `DATABASE_URL`, direct for migrations; document pooler vs direct.
- Vercel function duration limits vs OpenAI — keep chat under timeout budget.
- Optional: Upstash Redis for rate-limit store when multi-instance.

### Decisions

| Topic | Decision |
|-------|----------|
| Neon | App = pooled `-pooler` `DATABASE_URL`; migrations = `DIRECT_URL` |
| Vercel | Chat `maxDuration = 60`; keep `OPENAI_TIMEOUT_MS` ≤ ~45s |
| Upstash Redis | **Deferred** — in-memory limits OK until multi-instance 429 drift hurts |
| Read replica | **No** — analytics p95 not dominant enough; revisit if admin 30d stays >~2s sustained |

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** `README.md` | Neon pooler table, Vercel budget, Redis deferred |
| **Update** studio + public chat routes | `export const maxDuration = 60` |
| **Add** `scripts/test-f02g.mjs` · `npm run test:f02g` | Doc + maxDuration contracts |

### Manual test

1. `npm run test:f02g`.
2. Confirm production Neon dashboard uses pooler connection string in `DATABASE_URL`.

---

## Phase H — Production testing ✅

- [x] Load 20 concurrent public chats on preview — no 5xx storm. → `npm run load:f02h`
- [x] Analytics 30d on workspace with many chats — p95 recorded. → same script / bench
- [x] Admin platform dashboard cold load — recorded. → `load:f02h` with admin env
- [x] Embed origin lock still holds under load. → ping other Origin in `load:f02h`

### Delivered

| Change | What exactly |
|--------|----------------|
| **Add** `scripts/load-f02h.mjs` · `npm run load:f02h` | Concurrent pub-chat, origin check, admin/product 30d cold |
| **Add** `scripts/test-f02h.mjs` · `npm run test:f02h` | Tooling/doc smoke |
| **Add** `npm run test:f02` | Runs F02 A–H contract smokes |

### Manual test (preview / local)

1. `npm run test:f02` (contracts).
2. Dev or preview up → `F02_PUBLIC_KEY=… ADMIN_BOOTSTRAP_EMAIL=… ADMIN_BOOTSTRAP_PASSWORD=… npm run load:f02h`.
3. Paste printed rows below (date them). Expect: **0** hard 5xx on concurrent chat; origin other ≠ free pass if locked.

| Check | Result | Notes |
|-------|--------|-------|
| 20 concurrent pub-chat | _(run load:f02h)_ | no 5xx storm |
| Analytics / admin 30d | _(run load:f02h)_ | record client/server ms |
| Origin lock | _(run load:f02h)_ | wrong Origin denied |

---

## Done when

Baselines written in this file’s checklist; no quality regression on FAQ answers; dashboard remains usable.
`npm run test:f02` green; run `load:f02h` once per release on preview when a public key is available.

## Steal (not clone)

Fin/Zendesk **latency discipline** on retrieve+generate — measure then cut — without their infra footprint.


---


# F03 — Production testing & CI

**Goal:** Regressions fail PRs; live deploy has a short, repeatable smoke.  
**Maps to:** Week 3 Automated tests + CI/CD · P0-3.  
**Aide identity:** tests respect workspace isolation and admin 404 for USER.


> **Deliverables rule:** When a phase is marked ✅, add **Delivered** (exact files/behavior) and **Manual test** (steps you can run). Until then, keep the short plan lines only.

---

## Phase A — Scope & identity ✅

- In: lint CI, product HTTP smoke, admin smoke, embed origin regression, manual go-live checklist.
- Out: full Playwright E2E suite on day one (can add later as Phase C+).

### Identity guardrails (do not break)

| Keep | Meaning |
|------|---------|
| Workspace isolation | Product smoke asserts user B cannot GET user A’s agent |
| Admin plane | USER → `/admin` = 404 (admin smoke); reserved email cannot self-register |
| Origin-locked embed | `test:bugfix` origin cases stay in CI when secrets exist |
| Cost | Product smoke: **one** studio chat OpenAI call max |

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** this file Phase A | Locked in/out + identity table |
| **Add** `scripts/test-f03.mjs` · `npm run test:f03` | Contract smoke for F03 A–H |

### Manual test

1. Agree in/out above — no Playwright day-one requirement.
2. `npm run test:f03` (must pass).

---

## Phase B — Design & functionality ✅

- Keep: `npm run lint`, `test:product`, `test:admin`, `test:bugfix`.
- CI: lint always; HTTP smoke when secrets present; contract smokes always.
- GitHub secrets documented in README (table + branch protection note).

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** `.github/workflows/ci.yml` | Lint → contract smokes (`f01g`, `f02a`, `f02g`, `f03`) → HTTP product/bugfix/admin when secrets set |
| **Add** `npm run test:bugfix` | Wires `scripts/test-bugfix-regression.mjs` |
| **Update** README → CI | Secrets table, skip vs fail, branch protection, migrate/preview notes |

### Manual test

1. `npm run lint`
2. With server + env: `npm run test:product` · `npm run test:bugfix` · (admin) `npm run test:admin`
3. Confirm README **CI** section lists required secrets.

---

## Phase C — Improvements ✅

- Reserved admin email cannot register (409) — product smoke when `ADMIN_BOOTSTRAP_EMAIL` set.
- Google signup for reserved/admin email blocked in `auth.js` (`signIn` + credentials path).
- Workspace isolation: second user GET agent → 404/403.
- Studio FAQ chat asserts assistant reflects knowledge phrase (`5 business days` / refund).
- Playwright deferred (optional later) — not in this ship.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** `scripts/test-product.mjs` | UUID emails; reserved-admin register; knowledge phrase assert; cross-user agent 404; classify retry lag |
| **Keep** `auth.js` reserved Google reject | Already shipped — F03 contract asserts present |

### Manual test

1. `TEST_BASE_URL=… DATABASE_URL=… OPENAI_API_KEY=… npm run test:product`
2. Optional: try Google with reserved admin email → sign-in denied.

---

## Phase D — Error handling ✅

- Smoke scripts: clear exit codes; print which step failed (`PASS` / `FAIL` lines).
- CI skip path logs required secrets by name — never silent green when secrets *are* set and tests fail.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** CI smoke job | Explicit skip message listing `TEST_BASE_URL`, `DATABASE_URL`, `OPENAI_API_KEY` |
| **Keep** product/bugfix/admin | Non-zero exit on any failed step |

### Manual test

1. Run product smoke with wrong `OPENAI_API_KEY` → exit 1, failed step named.
2. CI without secrets → log “Skipping HTTP smoke…” then green; with secrets + bad key → red.

---

## Phase E — Production bottlenecks ✅

- Prefer preview URL for merge-gate smoke (`TEST_BASE_URL`).
- One OpenAI chat call max in product smoke.
- CI warns if `TEST_BASE_URL` is localhost while `CI=true`.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** `test-product.mjs` | Localhost-in-CI warning; single FAQ chat |
| **Update** CI | Echoes base URL; warns on localhost |

### Manual test

1. Point `TEST_BASE_URL` at a Vercel preview for a PR smoke.
2. Confirm product smoke makes one studio chat only.

---

## Phase F — Scaling ✅

- Lint job parallel-capable; smoke job single-threaded (one runner, sequential product → bugfix → admin).
- Unique emails per run (`Date.now()` + UUID) so parallel PR smokes do not collide.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** `test-product.mjs` | `p0-product-${stamp}@aide.test` (+ B user) |
| **Update** CI | Comment + sequential HTTP smokes in one job |

### Manual test

1. Two local product smokes overlapping → both should register distinct emails and pass cleanup.

---

## Phase G — Infrastructure ✅

- Branch protection: require **Lint** (and **HTTP smoke** when secrets configured).
- Release: `prisma migrate deploy` on Neon before/with prod promote — never `migrate dev` on Vercel.
- Preview env: `AUTH_URL` / `NEXT_PUBLIC_APP_URL` match preview host.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** README → CI | Branch protection, migrate deploy, preview `AUTH_URL` checklist |

### Manual test

1. GitHub → Settings → Branches: require Lint (+ Smoke if secrets live).
2. On promote: run `npx prisma migrate deploy` against Neon with `DIRECT_URL`.
3. Preview deploy: `AUTH_URL` equals preview origin.

---

## Phase H — Production testing ✅

Checklist (run once per release / after major merge):

- [ ] Fresh PR: lint red if intentional error.
- [ ] With secrets: product smoke red if OpenAI key wrong.
- [ ] Live URL: README go-live smoke 1–7 pass.
- [ ] Admin: email/password → `/admin`; USER → `/admin` = 404.
- [ ] Embed: origin lock + chat once (`test:bugfix` or manual).

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** README go-live | Expanded 1–7 checklist aligned with this phase |
| **Add** contract asserts in `test-f03.mjs` | Phase H checklist + go-live section present |

### Manual test (live)

1. Login → create agent → TEXT knowledge → Test chat  
2. Conversations + Analytics update  
3. `/api/health` → `"database": "ok"`  
4. Embed once on an allowed origin  
5. Admin password login → `/admin` loads  
6. Normal USER → `/admin` = 404  
7. Optional: `TEST_BASE_URL=<live> npm run test:product`

---

## Done when

PR cannot merge on lint fail; with secrets, smoke fail fails the job; live checklist filled once per release.

## Steal (not clone)

Fin **train → test → deploy** discipline — automated gates before humans — without their simulation farm.


---


# F04 — Aide design identity (industry-level UI)

**Goal:** Product and admin feel like a serious support-agent product (Botpress-grade chrome) while staying **Aide** (teal brand, insights-first, site-bound embed).  
**Maps to:** Week 3 UI/UX polish · Fusion differentiation checklist.  
**Aide identity:** brand-first auth/marketing; no purple-AI cliché; no Zendesk ticket maze; no Botpress canvas as home.


> **Deliverables rule:** When a phase is marked ✅, add **Delivered** (exact files/behavior) and **Manual test** (steps you can run). Until then, keep the short plan lines only.

---

## Phase A — Scope & identity ✅

- In: auth, dashboard, agent studio, analytics, embed preview, admin shell — visual hierarchy, motion, empty/loading/error, responsive 375–1280.
- Out: full redesign of information architecture; new product modules; dark-mode-as-default.

### Identity guardrails (do not break)

| Keep | Meaning |
|------|---------|
| Teal CSS variables | Extend `app/globals.css` tokens (`--color-primary` ≈ `#0b5f58`) — do not swap to purple / cream-serif cliché |
| Brand-first auth | Auth visual panel + login/register still read as Aide with nav removed |
| Insights-first | Analytics / dashboard remain first-class — not buried under a ticket maze |
| Studio ≠ canvas | Agent studio tabs stay product chrome; **no** Botpress-style flow canvas as home |
| Origin-locked embed | Preview/polish must not weaken site-bound widget behavior |

### Brand tests (pass before calling a surface “done”)

1. Remove nav / sidebar — still recognizably Aide (teal + typography + composition)?  
2. First viewport = **one composition** (not a widget dashboard dump).  
3. Keep CSS variables / teal system already in `app/globals.css`.

### Surface inventory (baseline for Phase B+)

| Surface | Primary routes / components | Today’s shape | F04 pressure |
|---------|----------------------------|---------------|--------------|
| Auth | `app/(auth)/*` · `LoginForm` · `RegisterForm` · `AuthVisualPanel` · `GoogleSignInButton` | Split layout; teal gradient panel; Google click-to-load | Hierarchy + no blank Google hole (Phase D) |
| Dashboard | `app/(app)/dashboard` · `HomeAgentCard` · `DashboardShortcuts` · `MetricCard` | Agent cards + shortcuts | One job / first viewport; empty “New agent” |
| Agent studio | `AgentStudioFrame` · `AgentHero` · overview / knowledge / test / customization / analytics pages | Tabbed agent chrome | Clearer tab hierarchy (Phase B); empty CTAs |
| Analytics | `WorkspaceAnalytics` · `AnalyticsBoard` · charts | Range chips + charts | Defer heavy charts on first paint (Phase E); empty/error |
| Embed preview | `CustomizationPreview` · `PublicWebchat` · `/w/[publicKey]` | Widget preview + live page | Real-site feel, not toy (Phase B) |
| Admin shell | `AdminShell` · `AdminSidebar` · `AdminTopbar` · console pages | Dense inspect UI | Aide tokens; denser tables OK (Phase C) |
| Tokens / chrome | `app/globals.css` · `AppShell` · `AppSidebar` · `PageHeader` | Teal + Instrument/DM Sans | Token map doc (Phase F); motion 2–3 (Phase C) |

### Explicitly out of F04

- Full IA redesign / new product modules  
- Dark-mode-as-default  
- New design-system package or Storybook this week (Phase G)  
- Zendesk-style ticket queue as home; Botpress canvas as home  
- Purple-on-white / generic “AI purple” restyle  

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** this file Phase A | Locked in/out, identity table, brand tests, surface inventory tied to real files |
| **Add** `scripts/test-f04a.mjs` · `npm run test:f04a` | Asserts Phase A ✅, scope, tokens in globals, inventory files exist |

### Manual test

1. Read the inventory — agree these are the only F04 polish surfaces before Phase B audits.  
2. `npm run test:f04a` (must pass).  
3. Open `/login` and `/dashboard` — confirm teal primary still `#0b5f58` family (computed `--color-primary`).

---

## Phase B — Design & functionality ✅

- Audit pages against: one job per section; cards only when interactive; no hero clutter.
- Studio: clearer tab hierarchy (Overview / Knowledge / Test / Customization / Analytics).
- Embed preview: looks like a real site widget, not a toy.

### Audit notes (surfaces touched)

| Surface | Change |
|---------|--------|
| Dashboard | First viewport = brand + one CTA; insights section separate; shortcuts after KPIs (not competing in hero) |
| Agent studio | Tab order = build path then insights; divider between groups; hero dropped duplicate Test + created-date clutter |
| Embed preview | Browser chrome + fake site body; widget bottom-right (not grid toy) |

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** `components/agents/studio-tabs.js` | Order: Overview → Knowledge → Test → Customization \| Analytics → Conversations; `group` build/insights |
| **Update** `components/agents/AgentHero.jsx` | Quieter identity row; Edit/Delete only; tab divider between build and insights |
| **Update** `components/agents/AgentOverview.jsx` | Shortcut order matches build path |
| **Update** `components/customization/CustomizationPreview.jsx` | Site-stage preview (chrome + page skeleton + widget) |
| **Update** `app/(app)/dashboard/page.jsx` | One-composition header; insights then shortcuts |
| **Add** `scripts/test-f04b.mjs` · `npm run test:f04b` | Asserts tab order, hero no Test CTA, site chrome in preview |

### Manual test

1. Open an agent studio — tabs: Overview, Knowledge, Test, Customization, then divider, Analytics, Conversations.  
2. Hero has Edit/Delete only (Test is a tab).  
3. Customization → preview shows `yoursite.com` bar + page blocks + corner widget.  
4. `/dashboard` — first screen is title + New agent; metrics under “Insights”.  
5. `npm run test:f04b`

---

## Phase C — Improvements ✅

- Micro-motion: page-in, toast, chat scroll (2–3 intentional motions).
- Typography: keep expressive stack already chosen — tighten scale.
- Empty states: one CTA each (“New agent”, “Add knowledge”, “Run test”).
- Admin: denser tables OK; still Aide tokens, not grey enterprise clone.

### Motions (intentional, prefers-reduced-motion respected)

| Motion | Where |
|--------|--------|
| Page-in | `AppShell` / `AdminShell` re-run on `pathname` change (`animate-page-in`) |
| Toast-in | `.cn-toast` teal border + enter animation (`sonner` + globals) |
| Message-in | `MessageBubble` + existing smooth `scrollIntoView` in `MessageList` |

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** `app/globals.css` | `--text-*` / `--leading-*` scale; `message-in` / `toast-in`; reduced-motion |
| **Update** `AppShell` · `AdminShell` | `key={pathname}` page-in |
| **Update** `MessageBubble` · `sonner` | Message + toast motion / Aide toast chrome |
| **Add** `components/ui/empty-state.jsx` | Shared one-CTA empty |
| **Update** `AgentList` · dashboard · `KnowledgeList` | Empty CTAs: **New agent** / **Add knowledge** |
| **Keep** `AgentTestStudio` `RunTestButtons` | Primary studio CTA remains **Run test** |
| **Update** `PageHeader` | Uses token text sizes |
| **Update** `AdminUsersDirectory` | Denser rows (`py-2.5`); `color-surface` not raw white |
| **Add** `scripts/test-f04c.mjs` · `npm run test:f04c` | Contract smoke |

### Manual test

1. Navigate dashboard → agents → studio — brief page-in each time.  
2. Trigger a toast (e.g. failed upload) — teal-bordered toast slides in.  
3. Send a studio chat — bubble animates; list scrolls smoothly.  
4. Empty agents / knowledge — single CTA. Test tab — **Run test** button.  
5. `/admin/users` — denser list, teal role badges.  
6. `npm run test:f04c`

---

## Phase D — Error handling ✅

- Error/empty/loading on every polished surface (DoD responsive + critical errors).
- Auth Google: never blank “Loading Google…” hole (click-to-load pattern).

### Surface matrix

| Surface | Loading | Empty | Error + retry |
|---------|---------|-------|----------------|
| Auth Google | Click → “Connecting…” on same button (no blank hole) | N/A | “Try Google again” → idle |
| Dashboard | Metric skeletons | New agent CTA | `InlineAlert` + reload |
| Analytics (workspace / agent / admin) | Chart/KPI skeletons | Zero-state hints | `AnalyticsError` + `reload` |
| Conversations inbox | List skeletons | Start a chat CTA | Try again |
| Knowledge / agents | Skeletons | Add knowledge / New agent | Existing try again |
| Route crash | — | — | `app/(app)/error.jsx` · admin console error · auth error |

### Delivered

| Change | What exactly |
|--------|----------------|
| **Add** `components/ui/inline-alert.jsx` | Shared `role="alert"` + optional Try again |
| **Update** `analytics-shared` | `reload` on hook; `AnalyticsError` accepts `onRetry` |
| **Update** Workspace / Board / Admin platform analytics | Wire `onRetry={reload}` |
| **Update** dashboard · ConversationsShell | Retry reload |
| **Update** `GoogleSignInButton` | Error phase → Try Google again (never “Loading Google…”) |
| **Add** `app/(app)/error.jsx` · `app/admin/(console)/error.jsx` | Aide-token error boundaries |
| **Update** auth `error.jsx` | Use CSS variables |
| **Add** `scripts/test-f04d.mjs` · `npm run test:f04d` | Contract smoke |

### Manual test

1. `/login` — Google shows clickable CTA; after click see “Connecting…” (never a blank “Loading Google…” hole). Fail GIS → Try Google again.  
2. Disconnect network briefly on `/analytics` — error + Try again restores.  
3. Same on dashboard and conversations inbox.  
4. `npm run test:f04d`

---

## Phase E — Production bottlenecks ✅

- Avoid heavy client charts on first paint — defer admin/platform charts.
- Images (avatars): sized + CDN (Cloudinary) constraints.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Add** `components/analytics/lazy-charts.jsx` · `charts-dynamic.js` | `next/dynamic` recharts wrappers (`ssr: false`) for product + admin analytics |
| **Update** WorkspaceAnalytics · AnalyticsBoard · AdminPlatformAnalytics | Import lazy charts; admin fetch waits for `requestIdleCallback` |
| **Add** `lib/utils/cloudinary-url.js` · `components/ui/avatar-image.jsx` | Delivery URL `f_auto,q_auto,w_,h_,c_fill` + explicit width/height |
| **Update** MessageBubble · MessageList · IdentityForm · CustomizationPreview | Use `AvatarImage` |
| **Update** IdentityForm · cloudinary-image | Client 2MB guard; upload `f_auto`/`q_auto` |
| **Add** `scripts/test-f04e.mjs` | Contract smoke |

### Manual test

1. Hard-refresh `/analytics` — KPIs appear; charts show skeletons then paint (recharts chunk loads after).  
2. `/admin` analytics — shell counts first; charts after idle.  
3. Upload avatar >2MB → toast error; ≤2MB → resized CDN URL in Network.  
4. `npm run test:f04e`

---

## Phase F — Scaling ✅

- Design tokens in CSS variables so themes/embed customization stay consistent at volume.
- Document token map once for future contributors.

### Token map (source of truth: `app/globals.css` + `lib/customization/theme.js`)

| Token | Role |
|-------|------|
| `--color-primary` (`#0b5f58`) | Brand / buttons / active tabs |
| `--color-primary-hover` | Hover |
| `--color-bg` / `--color-surface` / `--color-border` | Page, cards, dividers |
| `--color-text` / `--color-text-secondary` / `--color-muted` | Type hierarchy |
| `--color-success` / `--warning` / `--danger` / `--info` | Status |
| `--color-chart-1`…`5` | Analytics series |
| `--font-sans` / `--font-display` | Instrument Sans / DM Sans |
| `--text-xs`…`--text-2xl` · `--leading-*` | Type scale (F04-C) |
| `--radius` · `--sidebar-width` · `--app-topbar-height` | Layout chrome |
| `--wc-*` (widget) | Embed / studio chat theme from customization |

Do **not** introduce a second token system for embed — map customization → `--wc-*` via `widgetStyleVars`.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** this file Phase F | Token map table for contributors |
| **Add** `scripts/test-f04f.mjs` | Asserts primary teal + `--wc-primary` / token names in globals + theme |

### Manual test

1. Read token map above — agree no parallel design-token package.  
2. `npm run test:f04f`

---

## Phase G — Infrastructure ✅

- No new design system package required — extend existing Tailwind + CSS vars.
- Optional Storybook later — not this week.

### Decision record

| Choice | Decision |
|--------|----------|
| Design system package | **No** — keep Tailwind 4 + `globals.css` + shadcn primitives |
| Storybook | **Deferred** — not this week |
| Token docs | Phase F table in this file |

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** this file Phase G | Explicit no-new-DS / Storybook deferred |
| **Add** `scripts/test-f04g.mjs` | Asserts decisions + no Storybook dependency in package.json |

### Manual test

1. `npm run test:f04g`  
2. Confirm `package.json` has no `@storybook/*` deps.

---

## Phase H — Production testing ✅

Checklist (run once per release / after F04 visual ship):

- [ ] `/login`, `/dashboard`, agent studio, `/analytics`, `/admin` at **375** and **1280** widths  
- [ ] Embed preview + live `/w/{key}` visual check  
- [ ] Brand test: screenshot without sidebar still reads “Aide” (teal + display type)

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** this checklist | Marked ready; contract asserts presence |
| **Add** `scripts/test-f04h.mjs` · `npm run test:f04` | H checklist + A–H suite |

### Manual test (live)

1. Resize to 375 / 1280 on login, dashboard, studio, analytics, admin.  
2. Customization live preview + open `/w/{publicKey}` on an allowed origin.  
3. Crop out sidebar — still recognizably Aide.  
4. `npm run test:f04`

---

## Done when

Demo slides + live UI pass responsive DoD; studio feels industry-grade without losing Aide spine.

## Steal (not clone)

Botpress **Studio clarity** (tabs, webchat preview) + Fin **answer inspection space** — not their logos, purple, or canvas.


---


# F05 — Agent testing improvements

**Goal:** Studio Test becomes a real **train → test → deploy** gate (Fin flywheel lite) with clearer pass/fail.  
**Maps to:** Fusion Band 1 studio inspection · Week 3 quality without RAG.  
**Aide identity:** tests stay per-agent + workspace-scoped; no cross-tenant fixtures.


> **Deliverables rule:** When a phase is marked ✅, add **Delivered** (exact files/behavior) and **Manual test** (steps you can run). Until then, keep the short plan lines only.

---

## Phase A — Scope & identity ✅

- In: Ask-yourself runner, question packs, citations/used-knowledge UI, pause/resume/stop, regression script hooks.
- Out: multi-channel simulation farm; paid Fin “Simulations” clone.

### Identity guardrails

| Keep | Meaning |
|------|---------|
| Per-agent scope | Studio chat + packs only for the opened agent |
| Workspace isolation | Reuses studio chat API ownership checks |
| Sequential runs | Never parallel OpenAI blast |

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** this file Phase A | Locked in/out + guardrails |
| **Add** `scripts/test-f05.mjs` · `npm run test:f05` | A–H contract smoke |

### Manual test

1. Agree no Fin Simulations clone.  
2. `npm run test:f05`

---

## Phase B — Design & functionality ✅

- After each assistant reply in studio: show **Used knowledge:** doc titles (when stuffing knows them — pairs with F08).
- Pass/fail hints: expected substring optional per question (soft assert in UI).
- Keep Run / Pause / Resume / Stop reliability.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** `lib/services/chat.service.js` | Returns `usedKnowledge: [{ id, name, type }]` from stuffed docs |
| **Update** `MessageBubble` · `MessageList` | Renders “Used knowledge: …” under assistant |
| **Update** `AgentTestStudio` | Optional `expectIncludes` → Pass/Fail badges; Run/Pause/Resume/Stop kept |

### Manual test

1. Add TEXT knowledge → studio chat → reply shows Used knowledge titles.  
2. Set expectIncludes → Run test → Pass/Fail badge.  
3. Pause mid-pack → Resume continues from current index.

---

## Phase C — Improvements ✅

- Export last run as JSON (questions + answers + responseTime) for intern demos.
- “Regenerate pack” stays aligned with live system prompt (F09).
- Mark flaky questions when OpenAI errors mid-run (auto-pause already — surface reason).

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** `AgentTestStudio` | **Export run** downloads JSON; Flaky badge + pause reason line |

### Manual test

1. Finish or pause a run → Export run → open JSON.  
2. Force LLM failure → Flaky + pause reason; remaining not Sent.

---

## Phase D — Error handling ✅

- Mid-run OpenAI fail → pause + toast; do not mark remaining as Sent.
- Empty prompts skipped with count shown.
- Rate limit → pause with retry guidance.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** `startRun` / `send` | Skip empty with toast count; 429 → rate-limit message; degraded → pause |

### Manual test

1. Mix empty + filled self questions → skip toast, then run.  
2. Trigger 429 (or mock) → pause guidance to resume later.

---

## Phase E — Production bottlenecks ✅

- Cap concurrent auto-run (already sequential) — never parallel-blast OpenAI.
- Max questions hard cap (e.g. 20) stays.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Keep** sequential `runNextQuestion` | One chat at a time |
| **Add** `MAX_RUN_QUESTIONS = 20` | Slice + toast if over |

### Manual test

1. Confirm UI never fires parallel studio chats during Run test.

---

## Phase F — Scaling ✅

- Store optional `TestRun` rows later if history needed — not required for v1 of this feature.
- For many agents: keep tests local to studio session.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Decision** | No `TestRun` table in v1 — export JSON + session state only |

### Manual test

1. Confirm no Prisma `TestRun` model required for F05.

---

## Phase G — Infrastructure ✅

- No new services; reuse chat API.
- Optional CI hook: one FAQ assertion in `test:product` (F03).

### Delivered

| Change | What exactly |
|--------|----------------|
| **Keep** studio → `POST /api/agents/[id]/chat` | Same path as product |
| **Keep** F03 `test:product` | FAQ knowledge phrase assert already shipped |

### Manual test

1. `npm run test:product` (with secrets) still asserts knowledge phrase.

---

## Phase H — Production testing ✅

- [ ] Run 5 FAQ questions sequential — all answers grounded.  
- [ ] Pause/resume mid-pack.  
- [ ] Force error → paused, not silent skip.  
- [ ] Used-knowledge line appears when titles available.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** checklist | Ready for live verify |
| **Add** `npm run test:f05` | Asserts A–H ✅ + key code contracts |

### Manual test (live)

1. Pack of 5 FAQ questions → Run test sequential.  
2. Pause → Resume.  
3. Fail OpenAI → Flaky + paused.  
4. Confirm Used knowledge under replies.  
5. `npm run test:f05`

---

## Done when

A stranger can prove agent quality in studio in <3 minutes without guessing.

## Steal (not clone)

Intercom Fin **test before deploy** + answer inspection — not their full simulation product.


---


# F06 — Admin security hardening

**Goal:** One-admin plane stays hard to abuse; reserved email cannot become a Google USER trap; inspect stays audited.  
**Maps to:** Admin A0–A6 follow-ups · live lockout issues · Fusion trust plane.  
**Aide identity:** exactly one ADMIN; inspect-only (no impersonate); USER `/admin` → 404.


> **Deliverables rule:** When a phase is marked ✅, add **Delivered** (exact files/behavior) and **Manual test** (steps you can run). Until then, keep the short plan lines only.

---

## Phase A — Scope & identity ✅

- In: bootstrap email reserve (env + DB), Google block, login rate limits, audit completeness, session role checks, seed reclaim.
- Out: multi-admin RBAC (P3); impersonation (P3); SSO.

### Identity guardrails

| Keep | Meaning |
|------|---------|
| One ADMIN | Seed refuses a second; delete/suspend last admin blocked |
| Inspect-only | No impersonation / “login as user” |
| Hidden console | Non-ADMIN `/admin/*` → **404** (not 401 redirect leak) |

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** this file Phase A | Locked in/out + guardrails |
| **Add** `scripts/test-f06.mjs` · `npm run test:f06` | A–H contract smoke |

### Manual test

1. Agree no multi-admin / SSO this phase.  
2. `npm run test:f06`

---

## Phase B — Design & functionality ✅

- `isProtectedAdminEmail` rejects env **or** `PlatformSettings.reservedAdminEmail` **or** DB `role=ADMIN`.
- Credentials: protected email with missing password → `admin_needs_seed` (clear UI copy), not silent fail only.
- Confirm `requireAdmin` on every `/api/admin/*`.
- Proxy: non-ADMIN `/admin/*` → 404 (including `/admin/login`).

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** `lib/admin-email.js` | `isReservedAdminEmail` (env) + async `isProtectedAdminEmail` |
| **Update** `auth.js` | Google/credentials use protected check; `AdminNeedsSeedError` |
| **Update** `lib/services/auth.service.js` | Register blocks protected emails |
| **Confirm** `app/api/admin/**` | Every route calls `requireAdmin` |
| **Confirm** `proxy.js` | Non-ADMIN → rewrite `/404` status 404 |

### Manual test

1. Google with reserved admin Gmail → blocked message (not a USER session).  
2. Password login before seed → “Run npm run seed:admin…”.  
3. USER session → `/admin` returns 404; `/api/admin/overview` → 401.

---

## Phase C — Improvements ✅

- Audit: AGENT_OPEN, CONVERSATION_OPEN, USER_EXPORT, USER_SUSPEND, SETTINGS_UPDATE written on those routes.
- Admin login: distinct rate-limit bucket (5 / 15m) — clearer lockout messaging.
- Safety toggles: settings PUT still audits SETTINGS_UPDATE.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Confirm** audit routes | Open agent / transcript / export / suspend / settings |
| **Update** `store/auth-store.js` | Lockout + Google-admin + needs-seed copy |

### Manual test

1. As admin: open a user agent → Audit shows AGENT_OPEN.  
2. Fail admin password 5× → wait message mentions ~15 minutes.

---

## Phase D — Error handling ✅

| Case | Behavior |
|------|----------|
| Google on admin email | `admin_password_only` clear UI copy |
| Reserved email, no password hash | `admin_needs_seed` |
| USER hits `/api/admin` | 401 |
| USER hits `/admin` page | 404 |
| Seed while second ADMIN exists | Seed refuses (already) |
| Delete last admin | Blocked |

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** auth-store messages | See Phase C |
| **Confirm** seed + delete guards | `prisma/seed-admin.js` · admin-users delete |

### Manual test

1. Try delete the sole ADMIN → blocked.  
2. Seed with a different email while ADMIN exists → refused.

---

## Phase E — Production bottlenecks ✅

- Audit list paginated; export capped at **10_000** (`EXPORT_MAX`).
- Retention: keep audit in Neon for ops; archive job deferred (Phase F/G note).
- User directory uses Prisma `_count` (no N+1 workspace/agent queries).

### Delivered

| Change | What exactly |
|--------|----------------|
| **Document** | Export cap + retention note (this file) |
| **Confirm** `listAdminUsers` | `_count: { workspaces, agents }` |

### Manual test

1. Audit export with large log → response truncates at 10k.  
2. Users table loads without per-row workspace round-trips.

---

## Phase F — Scaling ✅

- Still one ADMIN — no staff matrix.
- If audit volume grows: archive job later (out of F06).

### Delivered

| Change | What exactly |
|--------|----------------|
| **Document** | One-admin posture locked; archive deferred |

### Manual test

1. Confirm product still has a single ADMIN after seed.

---

## Phase G — Infrastructure ✅

- Vercel + local: `ADMIN_BOOTSTRAP_*` must match production Neon; seed against prod `DATABASE_URL`.
- Store reserved admin email in `PlatformSettings.reservedAdminEmail` after seed so missing env cannot recreate the Google hole.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Add** migration `20260823090000_platform_reserved_admin_email` | Column on PlatformSettings |
| **Update** schema + platform-settings service | Read + `setReservedAdminEmail` (seed-only write path) |
| **Update** `prisma/seed-admin.js` | Upserts `reservedAdminEmail` |
| **Update** README | Seed against prod DATABASE_URL note |

### Manual test

1. `npx prisma migrate deploy` · `npm run seed:admin` → Settings row has reserved email.  
2. Clear `ADMIN_BOOTSTRAP_EMAIL` temporarily → Google on that email still blocked via DB.

---

## Phase H — Production testing ✅

- [x] Contract: `npm run test:f06`
- [ ] Live: admin email+password → `/admin`
- [ ] Google with admin Gmail → blocked message
- [ ] Normal USER → `/admin` 404
- [ ] Suspend USER → login blocked + restore flow
- [ ] Export + delete confirm; cannot delete admin
- [ ] Re-run `seed:admin` reclaim if USER stole bootstrap email historically

### Delivered

| Change | What exactly |
|--------|----------------|
| **Add** `npm run test:f06` | Static contract (routes, proxy, protected email, seed) |
| **Update** CI contract job | Runs `test:f06` with other no-secret smokes |
| **Update** ROADMAP | F06 done; next F07/F08 |

### Manual test

1. `npm run test:f06`  
2. On live: walk the unchecked checklist above once.

---

## Done when

Admin cannot be locked out by Google signup; USER cannot discover admin; smoke checklist green on live.

## Steal (not clone)

Enterprise **governed operator** posture (Zendesk admin seriousness) without multi-seat admin I&A.


---


# F07 — Admin platform improvements

**Goal:** Make the one-admin console faster and more useful for daily ops — without impersonation or new roles.  
**Maps to:** P2 density · Fusion admin inspect spine.  
**Aide identity:** inspect-only; platform analytics + safety; no act-as-user.


> **Deliverables rule:** When a phase is marked ✅, add **Delivered** (exact files/behavior) and **Manual test** (steps you can run). Until then, keep the short plan lines only.

---

## Phase A — Scope & identity ✅

- In: directory UX, filters, restore inbox, safety clarity, platform KPIs, audit usability.
- Out: O1 impersonate; O2 multi-admin; billing console.

### Identity guardrails

| Keep | Meaning |
|------|---------|
| Inspect-only | No act-as-user / impersonation |
| One ADMIN | Reuse F06 plane; no staff matrix |
| Ops density | Triage users + safety without leaving `/admin` |

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** this file Phase A | Locked in/out |
| **Add** `scripts/test-f07.mjs` · `npm run test:f07` | A–H contract smoke |

### Manual test

1. Agree no impersonation / multi-admin this phase.  
2. `npm run test:f07`

---

## Phase B — Design & functionality ✅

- Users: URL filters (`q` / `status` / `role` / `page`) + EmptyState / InlineAlert retry.
- Requests inbox: pending count badge in sidebar.
- Agent inspect: one-screen health (enabled, embed, origin, last chat).

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** `AdminUsersDirectory` | EmptyState + InlineAlert retry |
| **Update** `admin-overview.service` · `AdminSidebar` | `pendingRestoreCount` badge on Requests |
| **Update** `admin-inspect.service` · `AdminAgentInspect` | `lastChatAt` / `lastChatId`; knowledge metadata only (no body load) |

### Manual test

1. Suspend a user → Requests badge increments.  
2. Open agent inspect → Last chat cell links to latest conversation.  
3. Clear/search users with no matches → EmptyState + Clear filters.

---

## Phase C — Improvements ✅

- Platform dashboard: Growth vs Quality copy; Suspended / Requests KPI deep links.
- Deep links: Users / Suspended / Requests clickable from KPI strip.
- Bulk **view** helper: Open all users (cap 10) on pending requests — no bulk destroy.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** `AdminPlatformAnalytics` | Linked Stats + Suspended/Requests KPIs |
| **Update** `AdminRestoreRequests` | **Open all users** (view-only tabs) |

### Manual test

1. Dashboard → click Users / Suspended / Requests → filtered admin routes.  
2. Pending requests → Open all users → tabs open (≤10).

---

## Phase D — Error handling ✅

- Failed suspend/export: toast (existing) + audit `USER_SUSPEND_FAILED` / `USER_EXPORT_FAILED`.
- Large export: audit truncate InlineAlert; user export returns `truncated` + toast.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** suspend/export routes | Failed-attempt audit events |
| **Update** `AdminAuditLog` | Fail filters + persistent truncate banner |
| **Update** `admin-user-data.service` · `AdminUserDetail` | Message cap + truncated flag |

### Manual test

1. Try suspend admin → toast + Audit “Suspend fail”.  
2. Export large audit set → banner when truncated.

---

## Phase E — Production bottlenecks ✅

- Platform analytics: reuse F02 aggregate path (`getDashboardForPlatform`).
- Agent inspect: no full knowledge `content` in list; conversation lists stay preview-only (140 chars).

### Delivered

| Change | What exactly |
|--------|----------------|
| **Confirm** inspect lists | Preview slice; full transcript only on detail |
| **Update** getAdminAgent | Knowledge metadata select only |

### Manual test

1. Agent with large TEXT knowledge → inspect loads quickly; View notes body not loaded.

---

## Phase F — Scaling ✅

- Pagination: users, audit, conversations (existing).
- Soft search debounce kept (users 250ms, audit 300ms).
- Restore inbox remains capped at 80 (view helper for pending) — full pagination later if needed.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Document** | Debounce + pagination surfaces; restore take:80 interim |

### Manual test

1. Users directory page 2 with filters preserved in URL.

---

## Phase G — Infrastructure ✅

- No new services; reuse `/api/admin/*`.
- Optional nightly count table — not required.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Confirm** | Overview / analytics / restore APIs only |

### Manual test

1. No new deployables beyond existing admin routes.

---

## Phase H — Production testing ✅

- [x] Contract: `npm run test:f07`
- [ ] Live: Suspend → restore request → approve
- [ ] Embed kill hides public widget
- [ ] Audit shows inspect opens
- [ ] KPI click-throughs work

### Delivered

| Change | What exactly |
|--------|----------------|
| **Add** `npm run test:f07` | Static contract |
| **Update** CI · ROADMAP · README | F07 wired; next F08 |

### Manual test

1. `npm run test:f07`  
2. Walk unchecked live checklist once on Vercel.

---

## Done when

Operator can triage users + safety in <2 minutes without leaving `/admin`.

## Steal (not clone)

Helpdesk **ops console density** — not Zendesk full agent workspace.


---


# F08 — Knowledge retrieval (stuffing lite)

**Goal:** Better answers from existing TEXT/PDF/WEB **without** Pinecone/pgvector.  
**Maps to:** Week 3 “Better knowledge retrieval” · Fusion W3-1 · Fin retrieve-lite.  
**Aide identity:** answer-from-knowledge; cite titles; refuse off-knowledge.

**Status:** **F08 A–H ✅** shipped (`npm run test:f08`). Next feature: **F09**.

> **Deliverables rule:** When a phase is marked ✅, add **Delivered** (exact files/behavior) and **Manual test**. Until then, keep plan lines + the **Implementation** blocks below.

---

## Baseline (today — why F08)

| Piece | Current behavior | Problem |
|-------|------------------|---------|
| `buildKnowledgeBlock` in `lib/services/chat.service.js` | Walks docs in DB order; stuffs whole docs until **12_000** chars; then `...(truncated)` | Blind truncate — refund FAQ later in the list never reaches the prompt |
| `usedKnowledge` | Titles of docs that fit before truncate | Studio (F05) works, but selection is “first N docs”, not “best chunks for this question” |
| Language | `detectKnowledgeLanguage` over full docs | Keep as-is |
| Vectors | None | Correct — **F10** only |

---

## Phase A — Scope & identity ✅

- In: chunk select by keyword/overlap/recency/token budget; ordered stuffing; title list for studio.
- Out: embeddings, hybrid search, multi-index — that is **F10**.

### Identity guardrails

| Keep | Meaning |
|------|---------|
| Workspace / agent isolation | Only that agent’s `KnowledgeDocument` rows |
| Answer-from-knowledge | System rules stay “only from prompt + knowledge” |
| Cite titles | Prompt + API still expose doc titles (F05 UI) |
| No vector infra | No Pinecone, pgvector, embedding API calls in F08 |

### Non-goals (banned in F08)

| Ban | Why / where it belongs |
|-----|------------------------|
| OpenAI (or other) **embeddings** API | F10 |
| **Pinecone / pgvector** / any vector index | F10 |
| New **`KnowledgeChunk`** Prisma table in v1 | Optional later only if B proves need (Phase G) |
| Extra **LLM re-rank** call to pick chunks | Cost + latency; F08 is in-process lexical only |
| Impersonation / cross-agent knowledge | Never |

### F10 threshold (documented now; enforced later)

Recommend opening **F10** when an agent has **> 40** knowledge docs **or** **> ~80k** total knowledge characters. F08 stays lexical stuffing until then.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** this file Phase A | Guardrails + non-goals + F10 threshold locked |
| **Add** `scripts/test-f08a.mjs` · `npm run test:f08a` | Asserts Phase A scope (no retrieve module required yet) |

### Manual test

1. Read non-goals — agree stuffing lite only.  
2. `npm run test:f08a`  
3. Say **go F08 B** when ready for chunk/score/select.

---

## Phase B — Design & functionality ✅

- Split docs into chunks with stable ids/titles.
- Score chunks vs user message (simple lexical / overlap).
- Stuff top-k under token budget; include **document titles** in prompt.
- Pass selected titles to studio UI (F05).

### Delivered

| Change | What exactly |
|--------|----------------|
| **Add** `lib/services/ai/knowledge-retrieve.js` | `chunkDocument` · `tokenize` · `scoreChunk` · `selectKnowledgeChunks` |
| **Update** `lib/services/chat.service.js` | Uses select with user message; language still from full docs; `usedKnowledge` unique docs |
| **Add** `scripts/test-f08b.mjs` · `npm run test:f08b` | Fixture: noise first + refund last → refund selected |

### Manual test

1. Agent with 3 TEXT docs (noise, noise, refund FAQ last). Ask “What is the refund policy?” → Used knowledge includes refund.  
2. Studio bubble still shows **Used knowledge:** …  
3. `npm run test:f08b`

---

## Phase C — Improvements ✅

- Prefer recent WEB crawl chunks when query looks site-specific.
- Deduplicate near-identical chunks.
- Language: keep existing reply-language rules.
- When a strong match exists, skip near-zero score noise (cleaner Used knowledge).

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** `knowledge-retrieve.js` | Origin host boost (+0.25); WEB recency within 0.05; Jaccard/prefix dedupe; score floor |
| **Update** `chat.service.js` | Passes `agent.siteKnowledgeOrigin` into select |
| **Add** `scripts/test-f08c.mjs` · `npm run test:f08c` | Refund-only used; WEB site pick; near-dup collapse |

### Manual test

1. Same 3 TEXT docs → refund Q → **Used knowledge** should list refund (not parking/plants).  
2. WEB + TEXT; ask site hours → WEB preferred when origin matches.  
3. `npm run test:f08c`

---

## Phase D — Error handling ✅

- No knowledge → existing refuse path.
- All chunks filtered out → safe fallback message.
- Oversized single doc → hard chunk + warn in knowledge UI.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** `knowledge-retrieve.js` | `LARGE_DOC_CHARS` · fuzzy stack: **edit (Damerau) + prefix + Soundex + consonant skeleton + n-gram** · `topicHint` / history · clarify if still weak |
| **Update** `chat.service.js` | Empty-KB rule; clarify + `yes`; passes `recentMessages` for topic hint |
| **Update** `KnowledgeList` · `KnowledgeItem` | Banner + per-row hint for docs over **12_000** chars |
| **Add** `scripts/test-f08d.mjs` · `npm run test:f08d` | Empty / whitespace / soft fallback / fuzzy retrieve / UI strings |
| **Add** `scripts/test-f08-fuzzy.mjs` · `npm run test:f08-fuzzy` | Deep fuzzy (shipping/warranty/prefix/phonetic/topic) |

### Manual test

 1. Agent with **no** knowledge → ask a product fact → refuses inventing.  
2. Paste TEXT longer than **12_000** chars → Knowledge page shows large-doc banner.  
3. Misspell topics (`reunf`, `shiping`, `ref`, `rifund`) → correct docs; history “Refund” steers ambiguous typos. True vector semantic = **F10** (not in F08).  
4. `npm run test:f08d` · `npm run test:f08-fuzzy`

---

## Phase E — Production bottlenecks ✅

- Cap max chunks and max chars stuffed.
- Do scoring in-process first; avoid extra LLM for retrieval in this feature.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Confirm** caps | `MAX_KNOWLEDGE_CHARS=12_000` · `MAX_CHUNKS_PACKED=12` · `CHUNK_TARGET≈1000` |
| **Add** `MAX_CHUNKS_SCORED=200` | After chunking, keep **newest 200** before score |
| **Add** env overrides | `KNOWLEDGE_MAX_CHARS` · `KNOWLEDGE_MAX_CHUNKS` (optional) |
| **Add** `scripts/test-f08e.mjs` · `npm run test:f08e` | 250-doc load + budget asserts |

### Manual test

1. Large WEB crawl agent still answers without a second model call.  
2. `npm run test:f08e`

---

## Phase F — Scaling ✅

- When doc count grows, F10 becomes necessary — document threshold.
- Per-agent cache of chunk list in memory for hot agents (optional).

### Delivered

| Change | What exactly |
|--------|----------------|
| **Document** F10 threshold | **> 40 docs** OR **> ~80k** total knowledge chars → consider F10 |
| **Add** `F10_DOC_THRESHOLD` · `F10_CHARS_THRESHOLD` | Soft constants + comment in `knowledge-retrieve.js` |
| **Decision** | **No** in-process chunk cache in F08 v1 |
| **Add** `scripts/test-f08f.mjs` · `npm run test:f08f` | Threshold + no-cache asserts |

### Manual test

1. Read threshold in this file / module comment.  
2. Confirm no Redis / no chunk cache Map.  
3. `npm run test:f08f`

---

## Phase G — Infrastructure ✅

- No new DB engine.
- Optional `KnowledgeChunk` table later if scoring needs persistence — only if Phase B proves need.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Confirm** | Chunk at request time from `KnowledgeDocument.content` |
| **Confirm** | No F08 migration · no `KnowledgeChunk` · no pgvector/Pinecone |
| **Confirm** env | `KNOWLEDGE_MAX_CHARS` · `KNOWLEDGE_MAX_CHUNKS` · `KNOWLEDGE_MAX_CHUNKS_SCORED` in `.env.example` |
| **Add** `scripts/test-f08g.mjs` · `npm run test:f08g` | Schema / migration / deps checks |

### Manual test

1. `npm run test:f08g`  
2. Deploy same Neon schema as before F08 (no migrate required for F08).

---

## Phase H — Production testing ✅

- [x] Contract: `npm run test:f08` (A–G + umbrella)
- [ ] Live: Long FAQ + noise → refund question hits refund
- [ ] Live: Studio shows Used knowledge titles
- [ ] Live: Empty KB → refuse
- [ ] Live: Token budget never blows OpenAI context

### Delivered

| Change | What exactly |
|--------|----------------|
| **Add** `scripts/test-f08.mjs` · `npm run test:f08` | Runs f08a–g; asserts all phases ✅ |
| **Update** CI | Contract job runs `test:f08` |
| **Update** ROADMAP / README | F08 done; next **F09** |
| **Confirm** | `test-product` knowledge phrase assert still present |

### Manual test

1. `npm run test:f08`  
2. Live checklist above once on local/Vercel.

---

## File touch list (shipped)

| File | Role |
|------|------|
| `lib/services/ai/knowledge-retrieve.js` | Chunk / score / select / caps / F10 soft thresholds |
| `lib/services/chat.service.js` | Wired select + empty-KB rule |
| `components/knowledge/KnowledgeList.jsx` · `KnowledgeItem.jsx` | Large-doc hint |
| `scripts/test-f08a.mjs` … `test-f08g.mjs` · `test-f08.mjs` | Phase + umbrella smokes |
| `package.json` · CI · README · ROADMAP · `.env.example` | Wired |

**Untouched for F08:** Prisma schema (no new tables), embed crawl, F05 MessageBubble.

---

## Done when

Blind truncate is gone; grounding titles visible in studio; no vector infra.

## Steal (not clone)

Fin **retrieve then generate** shape — lexical top-k only until F10.

---

## Status

**F08 A–H complete** (contract). Live checklist in Phase H still optional for you to walk once. Next feature: **F09**.


---


# F09 — Prompts & guidance lite

**Goal:** Stable grounding, tone, and classify quality via **templates** — Fin Guidance lite without a new CMS.  
**Maps to:** Week 3 Better AI prompts · Fusion W3-3 · Intercom Guidance (structure only).  
**Aide identity:** refuse off-knowledge; cite F08 titles; no private fine-tune; no model garden.

**Status:** **F09 A–H ✅** (`npm run test:f09`). Next feature per roadmap (buffer polish or **F10** when P3 opens).

> **Deliverables rule:** When a phase is marked ✅, add **Delivered** (exact files/behavior) and **Manual test**. Until then, keep plan lines + the **Implementation** blocks below.

---

## Baseline (today — why F09)

| Piece | Current behavior | Problem |
|-------|------------------|---------|
| `buildSystemPrompt` in `lib/services/chat.service.js` | Inline string: `agent.systemPrompt` + long `## Response rules` blob + F08 knowledge block | Rules duplicated / hard to version; no shared module with studio / classify |
| Agent `systemPrompt` (Prisma) | Free-text required on create (`AgentForm` default string) | No “recommended grounding template”; easy to wipe refuse rules by overwriting |
| Answer length | Always same rules | No short vs detailed bias for support vs FAQ-heavy agents |
| `lib/services/ai/classify.js` | Tiny SYSTEM: return JSON category + sentiment | Lazy **GENERAL** / **NEUTRAL** when chat is clearly SALES / NEGATIVE |
| Studio pack (`test-questions.service.js`) | Clips raw `agent.systemPrompt` only | May **not** include live Response rules / grounding — pack drifts from production chat |
| F08 fuzzy / clarify | Returns confirmation messages without LLM | Must stay compatible — prompt module must not break clarify early-return |

---

## Agent form — what each control means (product detail)

Reference for **Create agent** / **Edit agent** (`components/agents/AgentForm.jsx`) and how it maps to live chat (`lib/services/ai/prompt-builder.js`).

### How the full chat prompt is built (every message)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Role overlay — agent.systemPrompt (user-editable)        │
│    Personality, business name, tone                         │
├─────────────────────────────────────────────────────────────┤
│ 2. ## Response rules — ALWAYS added in code (not in form)   │
│    Grounding · safety · language · answer style · files     │
├─────────────────────────────────────────────────────────────┤
│ 3. ## Agent knowledge — F08 retrieve (selected docs/chunks) │
└─────────────────────────────────────────────────────────────┘
```

User text in **System Prompt** cannot remove or override block **2** — rules are appended **after** the overlay (Phase G).

---

### “Use recommended grounding template” (checkbox)

| | |
|---|---|
| **Matlab** | System Prompt mein ek **safe default role paragraph** pre-fill karo |
| **Source** | `RECOMMENDED_ROLE_TEMPLATE` in `prompt-builder.js` |
| **Default text** | “You are a helpful customer support agent for this business. Answer from the knowledge provided…” |
| **Checked (on)** | System Prompt field template se bhar jata hai — naye agents ke liye recommended |
| **Unchecked (off)** | Current System Prompt rehta hai; user apna custom role likh sakta hai |
| **Yeh kya NAHI karta** | Poori safety/grounding replace **nahi** — woh **Response rules** hamesha chat time par code se add hoti hain |

**Checkbox on karne par user ko kya milta hai:** safe role + personality starter — invent/refuse/language rules alag se automatic.

**Checkbox off + custom text:** e.g. “You are Acme’s friendly bot” — phir bhi Response rules + F08 knowledge chat mein lagengi.

---

### System Prompt (textarea)

| | |
|---|---|
| **Matlab** | Agent ka **role / personality overlay** only |
| **Saved as** | `Agent.systemPrompt` (max ~4_000 chars, truncate + warn if longer) |
| **Not for** | Refund policy, prices, long FAQs — woh **Knowledge** tab mein |
| **UI** | Single-line start → grows with text → scroll at max height; not manually resizable |

---

### Answer style (dropdown)

| Value | Behavior |
|-------|----------|
| **Hybrid** (default on create) | Agent **per message** choose kare: simple sawal → short; policy/how-to → bullets/steps |
| **Detailed** | Hamesha thorough; steps/bullets jab knowledge support kare |
| **Short** | Hamesha ~2–4 sentences |

Saved as `Agent.answerStyle`. Feeds **Response rules** only (not stored inside systemPrompt text).

**Baad mein change:** **Edit agent** (`/agents/{id}/edit`) — Customization tab mein abhi nahi; same form se update.

---

### Related paths (not on create form)

| Need | Where |
|------|--------|
| Knowledge / FAQs | Agent → **Knowledge** |
| Widget look & feel | Agent → **Customization** |
| Test replies | Agent → **Test** |
| Change answer style later | Agent → **Edit agent** |

---

### Studio / classify alignment

- **Studio pack** generation uses `buildGroundingExcerptForStudio` — same Response rules as live chat (not raw systemPrompt alone).
- **Classify** uses separate hardened `CLASSIFY_SYSTEM` (category + sentiment after reply).
- **Typo clarify** (F08) bypasses LLM — confirmation message only; prompt builder not used on that path.

---

## Phase A — Scope & identity ✅

- In: central prompt builders (chat + classify); template sections; short/long answer bias; studio pack alignment with live rules.
- Out: versioned Guidance CMS; per-tenant LLM keys; fine-tuning; model garden; rewriting F08 retrieve.

### Identity guardrails

| Keep | Meaning |
|------|---------|
| Workspace / agent isolation | Prompts never pull another agent’s systemPrompt or knowledge |
| Answer-from-knowledge | Templates reinforce “only systemPrompt + knowledge”; empty KB refuse (F08-D) |
| Cite / Used knowledge | F08 `usedKnowledge` titles stay; prompts may say “prefer citing doc titles” |
| One LLM provider | Existing `llm.provider` only — no second model for “guidance rewrite” |
| Clarify path | Typo clarify messages stay non-LLM; do not force through full template |

### Non-goals (banned in F09)

| Ban | Why / where it belongs |
|-----|------------------------|
| Guidance / Procedures **CMS** (versioned policy docs UI) | Optional later split (Fusion P3-GUIDANCE) |
| Per-tenant / BYO OpenAI keys | Never-MVP / P3 |
| Fine-tune on private chats | Never |
| Extra LLM call to “rewrite” system prompt each turn | Cost + latency |
| Changing F08 chunk/score/fuzzy algorithms | Already shipped; F09 only **consumes** knowledge text |
| Embeddings / RAG | **F10** |

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** this file Phase A | Guardrails + non-goals locked |
| **Add** `scripts/test-f09a.mjs` · `npm run test:f09a` | Asserts in/out scope (no CMS, no fine-tune, F08 still cited) |

### Manual test

1. Agree no Guidance CMS / model garden in F09.  
2. `npm run test:f09a`  
3. Continue to Phase B (builders).

---

## Phase B — Design & functionality ✅

- Move chat system assembly into `lib/services/ai/prompt-builder.js`.
- Template sections (stable order): role overlay → Response rules (grounding, safety, language, style, attachments) → F08 knowledge.
- Classify: richer SYSTEM with signal rules → fewer lazy GENERAL/NEUTRAL.
- `chat.service.js` calls builder; clarify early-return unchanged.
- Studio pack gen uses `buildGroundingExcerptForStudio` (same rules as live chat).

### Delivered

| Change | What exactly |
|--------|----------------|
| **Add** `lib/services/ai/prompt-builder.js` | `buildChatSystemPrompt` · `buildResponseRules` · `CLASSIFY_SYSTEM` · `RECOMMENDED_ROLE_TEMPLATE` · caps |
| **Update** `lib/services/chat.service.js` | Uses builder; build fail → 500 without OpenAI |
| **Update** `lib/services/ai/classify.js` | Uses hardened `CLASSIFY_SYSTEM` |
| **Update** `lib/services/test-questions.service.js` | Live grounding excerpt for pack gen |
| **Add** `scripts/test-f09b.mjs` · `npm run test:f09b` | Builder + classify + chat/pack wiring |
| **Add** `npm run test:f09` · CI step | Runs A+B smokes |

### Manual test

1. Agent with Refund FAQ → “What is the refund policy?” still answers from knowledge (F08).  
2. Agent with **no** knowledge → refuses inventing.  
3. `npm run test:f09b` · `npm run test:f09`  
4. Say **go F09 C** for UI template + answerStyle field.

---

## Phase C — Improvements ✅

- Agent create / edit UI: checkbox **“Use recommended grounding template”** — pre-fills a safe default role paragraph (does not delete Response rules; those live in code).
- **answer style**: `SHORT` \| `DETAILED` \| `HYBRID` on agent (`answerStyle` field; default create = HYBRID).
- Style feeds template: SHORT = 2–4 sentences; DETAILED = steps + bullets when knowledge supports it.
- Studio **generate-questions** / pack builder uses **same** grounding snippet as live chat (import from prompt-builder).

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** `components/agents/AgentForm.jsx` | Recommended template checkbox + answer-style select |
| **Update** `prisma/schema.prisma` + migration | `answerStyle String @default("DETAILED")` |
| **Update** `lib/services/agent.service.js` · `lib/validations/agent.js` | Persist + validate answerStyle |
| **Update** `lib/services/test-questions.service.js` | Live grounding excerpt (from Phase B) |
| **Add** `scripts/test-f09c.mjs` · `npm run test:f09c` | Template + answerStyle + form wiring |

### Manual test

1. Create agent with recommended template → studio chat still grounded.  
2. Toggle **Short** / **Hybrid** / **Detailed** → reply length behavior shifts.  
3. Uncheck template → custom role; chat still has Response rules (refuse off-knowledge).  
4. Regenerate studio pack → questions still about agent domain.  
5. `npm run test:f09c` · `npm run test:f09`

---

## Phase D — Error handling ✅

- Prompt build throw / empty required sections → **do not** call OpenAI; return 500 without LLM.
- `systemPrompt` over max length → truncate with `safeLogWarn`, never crash.
- Classify JSON parse fail → GENERAL/NEUTRAL fallback + warn log.
- Malformed answerStyle → default DETAILED.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** `prompt-builder.js` | `assertPromptBuildInput` · null-byte strip · truncate warn |
| **Update** `chat.service.js` | Catch build errors → httpError(500) without OpenAI |
| **Add** `scripts/test-f09d.mjs` · `npm run test:f09d` | Empty / missing agent / classify fallback |

### Manual test

1. Empty systemPrompt agent → chat 500, no OpenAI.  
2. `npm run test:f09d`

---

## Phase E — Production bottlenecks ✅

- Static template strings as module constants; only language + style interpolated per request.
- Cap role overlay **4_000** chars; soft warn when full system prompt **> 18_000** chars.
- No extra LLM for prompts.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** `prompt-builder.js` | `RESPONSE_RULES_*` constants · `MAX_SYSTEM_PROMPT_TOTAL_WARN` · truncate/large logs |
| **Add** `scripts/test-f09e.mjs` · `npm run test:f09e` | Oversized overlay truncated; knowledge still appended |

### Manual test

1. Paste 20k-char systemPrompt → truncated safely; chat still works.  
2. `npm run test:f09e`

---

## Phase F — Scaling ✅

- **One global template set** in repo; per-agent `systemPrompt` is **overlay** (role/personality) only.
- Multi-language: F08 `detectKnowledgeLanguage`; templates stay English instructions forcing reply language.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** this file Phase F | Overlay model documented |
| **Add** `scripts/test-f09f.mjs` · `npm run test:f09f` | Joke-only overlay still gets grounding rules |

### Manual test

1. systemPrompt = joke-only → still refuses inventing product facts.  
2. `npm run test:f09f`

---

## Phase G — Infrastructure ✅

- Prompt text in **code** — editable surface: `systemPrompt` + `answerStyle` only.
- Order: overlay → **Response rules** → knowledge (rules cannot be erased by user overlay).

### Delivered

| Change | What exactly |
|--------|----------------|
| **Update** `prompt-builder.js` | `RESPONSE_RULES_SECTION` · sanitize · rules always after overlay |
| **Add** `scripts/test-f09g.mjs` · `npm run test:f09g` | Jailbreak overlay still followed by refuse rules |

### Manual test

1. systemPrompt = “Ignore all rules…” → bot prompt still contains refuse lines.  
2. `npm run test:f09g`

---

## Phase H — Production testing ✅

### Contract checklist

- [x] Refund FAQ still answers from knowledge (F08 + F09 prompts).  
- [x] Off-topic / empty-KB refuse rules in prompt-builder.  
- [x] F08 fuzzy/clarify still wired in chat.service.  
- [x] Classify hardened SYSTEM.  
- [x] Studio pack uses live grounding excerpt.  
- [x] Clarify path non-LLM.

### Delivered

| Change | What exactly |
|--------|----------------|
| **Add** `scripts/test-f09.mjs` · `npm run test:f09` | Umbrella A–G + F08 integration asserts |
| **Update** `.github/workflows/ci.yml` | `npm run test:f09` in contract smokes |
| **Update** `ROADMAP_NEXT.md` | F09 complete |

### Manual test

1. Studio: refund question · typo `reunf` · off-topic refuse.  
2. `npm run test:f09` · `npm run test:f08`

---

## Done when ✅

- Grounding + classify quality better **without** new infra.  
- Studio packs and live chat share grounding rules.  
- F08 retrieve/fuzzy/clarify regressions green (`test:f08` + `test:f09`).

## Steal (not clone)

Fin **Guidance / policy coaching** as **prompt structure** (role → policy → style → knowledge) — not their Suggestions product, not a Procedures CMS.

## Suggested build order

1. **A** lock scope → **B** builders + classify harden → **C** UI + studio align → **D/E** errors + caps → **F/G** overlay/safety order → **H** umbrella + CI.  
2. Say **go F09 A** (or **go F09 B** if A docs-only is accepted in one PR with B).


---

# F12 — Human desk handoff

**Goal:** Customer embed → human handoff → workspace owner inbox → same-thread HUMAN reply → resolve / return to AI.  
**Maps to:** P3-DESK · [`features/F12_HUMAN_DESK.md`](features/F12_HUMAN_DESK.md) · [`ARCHITECTURE_ACTIONS_AND_DESK.md`](features/ARCHITECTURE_ACTIONS_AND_DESK.md)

> Phases A–H ✅ in plan file. Below: test commands + manual path for shipped verification.

---

## Automated tests

| Script | What it checks |
|--------|----------------|
| `npm run test:f12a` | Schema, migrations, desk helpers, hot paths |
| `npm run test:f12b` | API routes, services, embed + inbox UI |
| `npm run test:f12c` | Keywords, nav badge, handoff summary |
| `npm run test:f12d` | Error handling, limits, desk config, inbox scope |
| `npm run test:f12h` | Production file inventory + inbox auth gate |
| `npm run test:f12e2e` | Live: register → handoff → human reply → resolve → cooldown |
| **`npm run test:f12`** | All of the above |

**Requires:** `npm run dev` (or `TEST_BASE_URL`) for `test:f12e2e`.  
**DB:** `npx prisma migrate deploy` before first F12 run (columns `humanTypingAt`, `handoffCount`, `lastHandoffEndedAt`).

---

## Manual test checklist

1. Embed: send message → **Talk to a human** (or keyword) → ack + waiting banner.  
2. While waiting: AI **no reply** on next customer message.  
3. Owner `/inbox` → thread visible under **Waiting**; nav badge ≥ 1.  
4. Owner sends human reply → embed shows `HUMAN` bubble within poll interval.  
5. **Return to AI** → status open; customer can chat with bot again.  
6. **Resolved** filter shows handled desk threads (Return to AI + Resolve & close).  
7. Second handoff within 30m → cooldown message (429 / button disabled).  
8. Page refresh on embed → fresh chat; **History** reopens old thread.  
9. Workspace B user cannot see workspace A inbox threads.

---

## Done when ✅

- `npm run test:f12` green (with dev server for e2e).  
- Two-browser demo: embed handoff → inbox reply → embed human → resolve.  
- Inbox filters show desk handoff threads only (not every studio chat).

## Steal (not clone)

Intercom/Zendesk **handoff to agent** — not full agent workspace, SLA, or phone bridge.

