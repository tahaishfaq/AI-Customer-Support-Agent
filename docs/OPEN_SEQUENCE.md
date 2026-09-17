# Aide — Open work (sequence)

**Single remaining backlog.** Shipped history → [`SHIPPED_FEATURES.md`](SHIPPED_FEATURES.md).  
**Stand / go-live detail →** [`FULL_PATH_STAGE6_TO_PRODUCTION.md`](FULL_PATH_STAGE6_TO_PRODUCTION.md)
**Do one track at a time.** Last update: **2026-09-07**.

---

## Now (blockers → demo stable)

| # | Item | Done when | Local code gate |
|---|------|-----------|-----------------|
| **1** | **Production OpenAI credits** | Local hosted-search probe passes; production account/chat still owner-verified | LOCAL PROBE PASS 2026-09-17 (`probe:openai-web-search`); prod account still OWNER |
| **2** | **OpenAI hosted web-search migration** | Responses API path, citations, persistence, SSE/UI, and legacy-provider removal — [`features/OPENAI_WEB_SEARCH_MIGRATION_PLAN.md`](features/OPENAI_WEB_SEARCH_MIGRATION_PLAN.md) | CODE + local probe PASS — enable on prod + citation UI reload still OWNER |
| **3** | **One A3** live web | Online/web answer · hosted `web_search` OK — **1 call only** | OWNER — one product chat (probe ≠ full A3 chat path) |
| **4** | **B1–B4 confirm UI** (browser) | Confirm → consume · harness + local Playwright PASS; production URL check remains | `npm run test:confirmation-ui-browser` (app up) |
| **5** | **Billing pay smoke** | Plans → SafePay test → webhook / cancel | OWNER |
| **6** | **Prod cutover** | `ACTIONS_*` secrets · migrate · HTTPS `AUTH_URL` · live embed ping | OWNER + `node scripts/production-preflight.js --production` |
| **7** | **Unconditional YES** | Tick [`PRODUCTION_READY_SIGNOFF.md`](PRODUCTION_READY_SIGNOFF.md) | OWNER after #1–6 |

**Harness:** `npm run test:go-live-local` (no secrets printed).

---

## Next (after go-live green) — Redis + Realtime

| # | Item | Doc |
|---|------|-----|
| **8** | **R0 Redis foundation** — vendor, client, health, `REDIS_ENABLED` | Done (scaffold) — [`features/REDIS_BULLMQ_ENTERPRISE_PLAN.md`](features/REDIS_BULLMQ_ENTERPRISE_PLAN.md) |
| **9** | **R1 OTP in Redis** (+ Postgres audit) | Done (password-reset dual-write; VERIFY_EMAIL stays PG) |
| **10** | **R2 User profile cache** | Done — `getCachedPublicUser` + invalidate hooks |
| **11** | **R3 Global rate limits** (closes **R6**) | Done (RL + semaphore + confirm); live dual-instance ops check open |
| **12** | **R5 BullMQ workers** — email + billing queues (heavy work) | Done — sweeps + `/api/admin/queues` counts |
| **12b** | **R6 Crawl queue** | Done — `RUN_SITE_CRAWL` + per-agent lock; knowledge embeds deferred |
| **12c** | **R7 Socket↔Redis alignment** | Done — adapter + URL fallback + pool budget docs |
| **13** | **Socket Phases 0–4** | Automated gates green; live browser HA remains Phase 6 |
| **14** | **Socket Phases 5–6** | 5 + 6.0 code done; live two-replica chaos / alerts open |
| **15** | **Q0–Q5 TanStack Query** | Done — provider, desk/billing, mutations, socket sync, devtools |
| **16** | **Go-live #1–7** | **Active** — code gates via `test:go-live-local`; credits/probe/pay/cutover/signoff are OWNER |

---

## Later (only if needed)

| # | Item | Notes |
|---|------|-------|
| **17** | **Q4** Socket → invalidate Query cache | Done (RealtimeQuerySync) |
| **18** | **M01 MCP Tools UX** | [`features/MCP_DEEP_PLAN.md`](features/MCP_DEEP_PLAN.md) — don’t reopen orchestrator |
| **19** | **F10 Semantic RAG** | embeds on BullMQ `knowledge` queue — [`features/F10_SEMANTIC_RAG.md`](features/F10_SEMANTIC_RAG.md) |
| **20** | F00 live DoD ticks / deck | Owner — [`features/F00_DOD_DEMO_BUFFER.md`](features/F00_DOD_DEMO_BUFFER.md) · log [`shipped/F00_PROGRESS.md`](shipped/F00_PROGRESS.md) |
| **21** | Email EM4 webhook / EM5 product updates | Optional — [`features/EMAIL_RESEND_PLAN.md`](features/EMAIL_RESEND_PLAN.md) |
| **22** | Desk escalation / Botpress-parity UI | After sockets if still wanted — [`POST_MVP_BACKLOG_PLAN.md`](POST_MVP_BACKLOG_PLAN.md) |
| **23** | Teams / WhatsApp / SSO | Post-MVP — [`POST_MVP_BACKLOG_PLAN.md`](POST_MVP_BACKLOG_PLAN.md) |

---

## Sequence (do in order)

```text
1     Go-live prerequisites
2     OpenAI hosted web-search migration (legacy-provider removal)
3–7   Go-live validation → YES
8–11  Redis R0→R3 (OTP, profile, global limits)
12    BullMQ email/billing workers
13–14 Socket + Redis adapter
15–16 TanStack Query Q0–Q3 (can parallel with Redis — no hard dependency)
17+   MCP UX / RAG only if pain
```

**Invariant:** Redis/BullMQ/Sockets/Query = **infra / client-cache side-channels**. Never put PEP / confirm / identity authority there. Freeze: [`ARCHITECTURE_FREEZE_STAGE6.md`](ARCHITECTURE_FREEZE_STAGE6.md).

---

## Docs map (lean)

| File | Role |
|------|------|
| **This file** | Only ordered open work |
| [`FULL_PATH_STAGE6_TO_PRODUCTION.md`](FULL_PATH_STAGE6_TO_PRODUCTION.md) | Stand + feature/arch comparison |
| [`features/OPENAI_WEB_SEARCH_MIGRATION_PLAN.md`](features/OPENAI_WEB_SEARCH_MIGRATION_PLAN.md) | Legacy provider → OpenAI hosted web search migration |
| [`features/SOCKET_REALTIME_PLAN.md`](features/SOCKET_REALTIME_PLAN.md) | Socket architecture + phases |
| [`features/REDIS_BULLMQ_ENTERPRISE_PLAN.md`](features/REDIS_BULLMQ_ENTERPRISE_PLAN.md) | Redis OTP/profile/limits + BullMQ workers |
| [`features/TANSTACK_QUERY_FRONTEND_PLAN.md`](features/TANSTACK_QUERY_FRONTEND_PLAN.md) | Frontend server-state cache (TanStack Query) |
| [`PRODUCTION_READY_SIGNOFF.md`](PRODUCTION_READY_SIGNOFF.md) | Cond. → YES checklist |
| [`ARCHITECTURE_FREEZE_STAGE6.md`](ARCHITECTURE_FREEZE_STAGE6.md) | Frozen trust path |
| [`SHIPPED_FEATURES.md`](SHIPPED_FEATURES.md) | What already shipped (catalog) |
| [`shipped/`](shipped/README.md) | **Shipped plan archive** (full old plans) |
| [`POST_MVP_BACKLOG_PLAN.md`](POST_MVP_BACKLOG_PLAN.md) | Long OOS archive |
| Audits `AUDIT_*` | Competitor notes — not build todos |

`docs/features/` = **active / deferred / ops only** (socket, redis/bullmq, tanstack query, F10, MCP UX, email leftovers, billing). Shipped plan bodies live under `docs/shipped/`.
