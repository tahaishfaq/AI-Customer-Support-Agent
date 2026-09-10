# AIDE — Redis + BullMQ Enterprise Plan

**Status:** PLANNED (not started)  
**Created:** 2026-09-05  
**Pairs with:** [`SOCKET_REALTIME_PLAN.md`](SOCKET_REALTIME_PLAN.md) (Redis bus = shared foundation)  
**Freeze:** [`../ARCHITECTURE_FREEZE_STAGE6.md`](../ARCHITECTURE_FREEZE_STAGE6.md) — Redis/queues **must not** become PEP / confirm / identity authority  
**Active sequence:** [`../OPEN_SEQUENCE.md`](../OPEN_SEQUENCE.md)

---

## 0. Where the project stands today (no Redis / no BullMQ)

| Concern | Today | Pain at scale |
| --- | --- | --- |
| **OTP / verify tokens** | Postgres `EmailToken` (hashed) · TTL in DB | Fine for correctness; every OTP hit = DB write; no hot-path cache |
| **Rate limits** | In-memory `Map` in `lib/rate-limit.js` | **Per Vercel instance** — abuse can bypass by spreading IPs/instances (**R6 residual**) |
| **Outbound tool semaphore** | In-memory `lib/actions/outbound-semaphore.js` | Same multi-instance drift |
| **GET action cache** | In-memory `lib/actions/get-cache.js` | Cold every instance; no shared hit rate |
| **User / session profile** | Auth.js JWT + Prisma `User` on each `/api/auth/me` | Extra DB reads; no short-TTL profile cache |
| **Heavy work** | Sync in request path **or** manual scripts (`billing:renewal-reminders`, `email:onboarding-day1`, crawl schedule) | No retries/DLQ; cron ≠ durable queue; timeouts on serverless |
| **Realtime fan-out** | Poll only | Socket Phase 4 needs Redis adapter |
| **package.json** | No `ioredis` / `bullmq` / Upstash | Greenfield |

**Source of truth stays Neon Postgres.** Redis = hot ephemeral + coordination. BullMQ = durable async jobs.

```text
Authority (unchanged):
  USER → AUTH → CONTEXT → ORCHESTRATOR → ROUTER → PEP → GATEWAY → FENCE → ANSWER

Infra side-channel (new):
  App ──▶ Redis (cache / OTP / limits / pubsub)
  App ──▶ BullMQ ──▶ Workers (email, crawl, embeds, billing jobs)
```

---

## 1. What Redis + BullMQ will improve

| Area | Before | After (enterprise) |
| --- | --- | --- |
| **OTP** | DB round-trips + attempt rows | Redis hashed OTP + TTL + attempt counter; optional audit row in Postgres |
| **User profile** | Every `me` / nav hits DB | `user:profile:{id}` cache · invalidate on write |
| **Rate limits** | Per-instance Map | Global sliding/fixed window (closes **R6**) |
| **Tool GET cache** | Per-instance | Shared GET cache across nodes |
| **Socket / presence** | N/A | Redis adapter + presence keys (Socket plan) |
| **Email / crawl / renewals** | Sync or one-shot scripts | BullMQ queues · retries · backoff · DLQ · metrics |
| **Multi-instance** | Drift | Shared counters + job locks |

---

## 2. Target architecture

```text
                    ┌─────────────────────────────────────────┐
                    │              REDIS CLUSTER                │
                    │  db0: cache+OTP+limits+locks+pubsub     │
                    │  (or logical key prefixes on one DB)     │
                    └───────────┬─────────────┬───────────────┘
                                │             │
              ┌─────────────────┘             └──────────────────┐
              ▼                                                  ▼
     ┌────────────────┐                               ┌──────────────────┐
     │ Node app       │  enqueue jobs                 │ BullMQ Workers   │
     │ Next.js +      │ ─────────────────────────────▶│  email / crawl   │
     │ Socket.IO      │                               │  billing / RAG   │
     │ - OTP/profile  │                               │  webhooks retry  │
     │  - emit socket │◀──── pub/sub / adapter ───────│  (always-on)     │
     └───────┬────────┘                               └────────┬─────────┘
             │ persist authority                                │
             ▼                                                  ▼
        Neon Postgres ◀────────── job results / audit ─────────┘
```

### Hosting (enterprise default)

| Piece | Recommendation |
| --- | --- |
| **Redis** | **Upstash Redis** (serverless-friendly) or managed Redis (Railway/Redis Cloud) — TLS required |
| **Workers** | Always-on Node process(es): Railway / Fly / Render / ECS |
| **App** | Run Next.js and Socket.IO together on one always-on Node host; only **enqueue** + cache from app |
| **Bull Board / metrics** | Internal admin-only dashboard (IP allow + admin role) |

The same Node app host runs Socket.IO in-process; publisher/BullMQ workers may run
as separate processes while sharing Redis. There is no production socket-only
gateway requirement.

---

## 3. Redis key design (namespaces)

**Convention:** `{env}:{domain}:{…}` · always set **TTL** unless explicit lock with heartbeat.

| Key pattern | Type | TTL | Purpose |
| --- | --- | --- | --- |
| `aide:{env}:otp:reset:{userId}` | HASH | 5m (match `resetOtpTtlSec`) | `hash`, `attempts`, `tokenId` |
| `aide:{env}:otp:verify:{userId}` | STRING/HASH | 24h | verify token hash (or keep long verify in Postgres only — see Phase R1) |
| `aide:{env}:otp:cooldown:{email}` | STRING | 60s | resend cooldown |
| `aide:{env}:rl:{bucket}` | STRING / ZSET | window | global rate limit |
| `aide:{env}:profile:{userId}` | STRING (JSON) | 60–300s | public profile cache |
| `aide:{env}:ws:{workspaceId}:summary` | STRING | 30–120s | optional nav badges |
| `aide:{env}:action:get:{digest}` | STRING | 30s | shared GET tool cache |
| `aide:{env}:lock:{name}` | STRING | short + refresh | job / migrate locks |
| `aide:{env}:presence:…` | HASH/SET | 15–60s | Socket Phase 3 |
| `bull:{queue}:*` | BullMQ internal | — | **do not hand-edit** |

### OTP security rules (non-negotiable)

1. Store **SHA-256 hash only** (same as `lib/email/tokens.js`) — **never** raw OTP in Redis.  
2. Cap `attempts`; on lock delete key + mark consumed.  
3. No OTP values in logs / BullMQ payloads / metrics labels.  
4. Postgres `EmailToken` remains **audit + recovery** (write-through or write-behind) until Phase R1 proves Redis-only hot path.  
5. Timing-safe compare stays server-side.

### Profile cache rules

**Allowed fields:** `id`, `name`, `email`, `role`, `emailVerified`, `image` (if any), `updatedAt`.  
**Forbidden:** password hash, OAuth tokens, billing PANs, `ACTIONS_*` secrets, admin flags beyond role.

**Invalidate on:** password change, email verify, name update, suspend/restore, role change.

```text
readProfile(userId):
  hit Redis → return
  miss → Prisma User → setex Redis → return

writeProfile(...):
  Prisma update → DEL profile key (or setex fresh)
```

---

## 4. BullMQ — queues & workers (enterprise)

### Queues

| Queue | Priority | Jobs | Concurrency (start) |
| --- | --- | --- | --- |
| `email` | high | password reset OTP send, verify, billing notices, onboarding day-1 | 5–10 |
| `billing` | high | renewal reminders, past_due nudges, webhook redrive | 3–5 |
| `crawl` | normal | site re-crawl schedule, one-time crawl | 1–2 (CPU/IO heavy) |
| `knowledge` | normal | chunk ingest, optional embed batch (F10 later) | 1–2 |
| `realtime- downstream` | low | optional: fan-out heavy notify batches | 5 |
| `dead` / DLQ | — | failed after max attempts | inspect only |

### Job envelope (standard)

```js
{
  jobId: "email:password_reset:{tokenId}",  // idempotent
  type: "PASSWORD_RESET_OTP",
  userId,
  // NEVER: raw OTP — worker loads from secure store or receives hash id only
  requestId,           // trace
  workspaceId?,        // tenant scope
  enqueuedAt
}
```

### Worker policies

| Policy | Value |
| --- | --- |
| Attempts | 5 (email/billing) · 3 (crawl) |
| Backoff | exponential 2s → 2m |
| Timeout | email 30s · crawl 10–15m · embed batch 5m |
| Remove on complete | age 24h / count 1000 |
| Remove on fail | keep 7d for DLQ review |
| Rate limit per queue | protect Resend / OpenAI / crawl targets |
| Stalled interval | default BullMQ + alert |

### What moves off the request path

| Today | Becomes |
| --- | --- |
| Sync Resend in API (partially already fire-and-forget) | `email` queue — API returns 202 / “check inbox” after enqueue |
| `scripts/billing-renewal-reminders.mjs` cron | repeatable BullMQ job |
| `scripts/email-onboarding-day1.mjs` | repeatable + per-user jobs |
| Crawl schedule ticks | `crawl` queue |
| Future F10 embedding | `knowledge` queue |
| Heavy admin export | dedicated `export` queue (later) |

**Chat / orchestrator / tool invoke stay synchronous** (latency + confirm UX). Do **not** put PEP decisions in workers.

---

## 5. Phased plan

### Phase R0 — Foundation (½–1 day)

- [ ] Choose Redis vendor (Upstash vs Redis Cloud) + TLS URL  
- [ ] `REDIS_URL` / `REDIS_TOKEN` in env · never commit  
- [ ] `lib/redis/client.js` — singleton, reconnect, timeout, `aide:{env}:` prefix helper  
- [ ] Health: `/api/health` includes `redis: up|down` (degraded mode if down)  
- [ ] Feature flag `REDIS_ENABLED=0|1` — fail open to current Map/DB when off  
- [ ] ADR: workers host + queue names locked  

**Done when:** app connects; health green; no behavior change yet.

---

### Phase R1 — OTP in Redis (+ Postgres audit)

- [ ] Write path: create OTP → hash → `SETEX` Redis + insert/update `EmailToken` (audit)  
- [ ] Consume path: Redis first; on miss fall back Postgres (migration window)  
- [ ] Attempts + lock in Redis HASH  
- [ ] Resend cooldown key  
- [ ] Tests: expiry, lock after N, no raw OTP in Redis `GET` dumps in CI mocks  
- [ ] Metrics: otp_hit, otp_miss, otp_lock  

**Done when:** reset + verify flows green with Redis primary.

---

### Phase R2 — User profile cache

- [ ] `getCachedPublicUser(userId)` used by `/api/auth/me` and workspace shell  
- [ ] Invalidate hooks in auth/profile/admin suspend  
- [ ] TTL 60–300s · stampede lock (singleflight) optional  
- [ ] Tests: miss→fill→hit; invalidate after name change  

**Done when:** p95 `me` DB load drops under load test.

---

### Phase R3 — Global rate limits + semaphores (closes R6)

- [ ] Replace `lib/rate-limit.js` Map with Redis fixed/sliding window  
- [ ] Migrate outbound semaphore + confirm approve limits  
- [ ] Keep in-memory **fallback** if Redis down (fail-open vs fail-closed: **auth OTP fail-closed**, **public chat fail-open with tighter local** — document choice)  
- [ ] Stage 6.4-style abuse retest  

**Done when:** two app instances share one counter in test.

---

### Phase R4 — Shared caches (actions GET, optional badges)

- [ ] Port `get-cache.js` to Redis  
- [ ] Optional workspace waiting-count short cache (until Socket Phase 1)  
- [ ] Size / TTL caps; never cache WRITE/tool secrets  

---

### Phase R5 — BullMQ workers (enterprise async)

- [ ] Packages: `bullmq` + Redis connection shared  
- [ ] Worker service repo path: `workers/` or `apps/worker` — separate start script `npm run worker`  
- [ ] Implement `email` + `billing` queues first (move renewal/onboarding scripts)  
- [ ] Idempotent `jobId`s · DLQ · structured logs with `requestId`  
- [ ] Admin-only Bull Board or minimal `/api/admin/queues` (counts only)  
- [ ] Runbooks: retry, drain, pause queue  

**Done when:** renewal reminder + OTP email survive worker restart without duplicate spam (idempotency).

---

### Phase R6 — Crawl / knowledge / heavy IO

- [ ] `crawl` queue for schedule + manual crawl  
- [ ] Optional `knowledge` embed jobs when F10 opens  
- [ ] Concurrency 1 per agent crawl lock (`aide:{env}:lock:crawl:{agentId}`)  

---

### Phase R7 — Socket alignment

- [ ] Redis pub/sub or adapter for Socket plan Phase 4  
- [ ] Presence keys  
- [ ] One Redis, two consumers (gateway + workers) — connection pool limits documented  

---

## 6. Sequence vs sockets & go-live

```text
① Go-live leftovers (OPEN_SEQUENCE #1–6)     ← still first for demo
② Redis R0–R1 (OTP) + R2 (profile)          ← high ROI, independent of sockets
③ Redis R3 (global rate limits = R6 close)
④ BullMQ R5 (email/billing workers)
⑤ Socket S0–S3 (can start after R0; needs Redis for multi-node at S4)
⑥ Redis R4/R6/R7 + Socket S4 together
⑦ F10 RAG embeds on knowledge queue only if needed
```

**Recommended:** Redis **R0–R3 before or in parallel with** Socket S0 — sockets without Redis stay single-node.

---

## 7. Enterprise non-functionals

| Area | Requirement |
| --- | --- |
| **Security** | TLS Redis; ACL user with minimal commands; no `KEYS *` in prod app; OTP hash-only; PII TTL |
| **Multi-tenant** | Keys include `userId` / `workspaceId`; never cross-tenant profile get |
| **HA** | Redis HA / Upstash multi-region optional; worker ≥2 replicas with BullMQ locks |
| **Observability** | Queue depth, fail rate, latency; Redis memory %; alert on DLQ &gt; 0 |
| **Disaster** | Redis flush ≠ data loss for User/Subscription (Postgres); OTP re-send UX |
| **Cost** | Cap TTLs; avoid huge values; crawl payloads store S3/DB ids not HTML blobs in Redis |
| **Compliance** | EmailDeliveryLog stays Postgres; Redis not system of record for billing |

---

## 8. Env & file map (when implementing)

```bash
REDIS_URL=
REDIS_TOKEN=          # Upstash
REDIS_ENABLED=1
REDIS_KEY_PREFIX=aide:prod:
BULLMQ_ENABLED=1
WORKER_CONCURRENCY_EMAIL=5
```

| Layer | Likely paths |
| --- | --- |
| Client | `lib/redis/client.js`, `lib/redis/keys.js` |
| OTP | `lib/email/tokens.js` (dual-write) |
| Profile | `lib/services/user-profile-cache.js` |
| Rate limit | `lib/rate-limit.js` |
| Queues | `lib/queue/index.js`, `lib/queue/email.js`, … |
| Workers | `workers/index.js`, `workers/processors/*` |
| Health | `app/api/health/route.js` |

---

## 9. Success metrics

| Metric | Target |
| --- | --- |
| OTP verify p95 | Redis hit &lt; 20ms (excl. network to client) |
| `/api/auth/me` DB queries | ≥ 70% served from cache under steady nav |
| Rate limit consistency | Same key blocked across 2 instances |
| Email job success | ≥ 99% within 3 attempts |
| Duplicate password-reset emails | 0 for same `jobId` |
| Orchestrator freeze | Unchanged |

---

## 10. Out of scope

- Replacing Auth.js sessions entirely with Redis sessions (optional later; not required)  
- Putting tool allow/deny or confirm approve in Redis as authority  
- Storing full chat history in Redis  
- Using Redis as primary billing ledger  

---

**Next:** Phase R0 vendor + `REDIS_ENABLED` flag decision, then R1 OTP dual-write.  
**Cross-link:** Socket plan Phase 4 assumes this Redis exists.
