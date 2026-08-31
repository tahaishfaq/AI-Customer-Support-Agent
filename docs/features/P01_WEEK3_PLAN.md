# P1 — Optional Week 3 (execution)

**Source:** [`POST_MVP_BACKLOG_PLAN.md`](../POST_MVP_BACKLOG_PLAN.md) § P1  
**Rule:** Pick **2–3** IDs only — not the whole band.  
**Started:** Aug 30, 2026

---

## Chosen for this sprint

| ID | Item | Why | Status |
|----|------|-----|--------|
| **W3-1** | Stuffing retrieval (not vector) | Large KBs truncate one doc; fair pack + cited sources | ✅ Aug 30 |
| **W3-3** | Better AI prompts | Classify + grounding already partial (F09); tighten cite rules | ✅ Aug 30 |
| **W3-7** | UI/responsive 375px | DoD “responsive”; auth + studio audit | ✅ Aug 30 |
| **W3-5** | Performance optimization | SQL analytics aggregates + index | ✅ Aug 30 |
| **W3-6** | Analytics CSV export | Named gap — export KPIs/agents/trends | ✅ Aug 30 |
| **W3-4** | Logging | F01 observability + W3-4 gaps (requestId on analytics fail, public chat duration) | ✅ Aug 30 |

**Not this sprint:** W3-2 (vector → P3-RAG).

---

## W3-1 — Done when

- [x] Multi-doc agents pack chunks from **more than one** doc when query matches several (round-robin + per-doc cap).
- [x] Stuffed prompt shows **doc title + type**; WEB chunks show **source URL** when known.
- [x] Char budget unchanged (`MAX_KNOWLEDGE_CHARS`); no embeddings / pgvector.
- [x] `npm run test:p01-w3-1` passes; existing `test:f08*` still pass.

**Verify:** `npm run test:p01-w3-1` · `npm run test:f08e`

---

## W3-3 — Done when

- [x] Grounding rules tell model to **name the knowledge doc** when answering policy/FAQ.
- [x] Classify spot-check: pricing/sales/negative less often stuck on GENERAL/NEUTRAL (prompt already hardened — add smoke examples).
- [x] Studio test questions use `buildGroundingExcerptForStudio` via `test-questions.service.js` (same rules as chat).

---

## W3-7 — Done when

- [x] `/login`, `/register`, agent studio tabs, `/analytics`, `/admin` usable at **375px** and **1280px**.
- [x] Google slot never empty infinite height on mobile.

---

## W3-6 — Done when

- [x] **Export CSV** on product `/analytics`, agent analytics, and admin platform dashboard.
- [x] Summary, agents, trends, topics, sentiment (+ platform growth on admin).
- [x] Client-side from loaded dashboard payload — no new API route, no chart rebuild.
- [x] `npm run test:p01-w3-6` passes.

**Verify:** `npm run test:p01-w3-6` · manual: Export → Summary KPIs on `/analytics`

---

## W3-5 — Done when

- [x] Dashboard charts use **SQL aggregates** (`analytics-sql.js`) — no 8k conversation `findMany`.
- [x] KPIs always from SQL `count` / `groupBy` (exact path, not sample-only when under cap).
- [x] Platform growth uses SQL date buckets (not `findMany` all users/agents).
- [x] Composite index **`Conversation(agentId, startedAt)`** for range scans.
- [x] Classify after-return remains default (`CLASSIFY_AFTER_RETURN` unset).
- [x] `npm run test:p01-w3-5` passes.

**Verify:** `npm run test:p01-w3-5` · `npm run test:f02c` · optional `npm run bench:f02b`

---

## W3-4 — Done when

- [x] Structured JSON logs: `requestId`, `agentId`, `durationMs` on chat/classify/crawl/analytics failures.
- [x] No transcript / prompt / email in prod logs (`safe-log` allowlist).
- [x] Optional `x-request-id` header echoed on API responses.
- [x] Success chat logs sampled/off by default (`LOG_CHAT_SUCCESS` / `LOG_INFO_SAMPLE_RATE`).
- [x] `npm run test:p01-w3-4` passes (maps F01 observability + W3-4 contracts).

**Verify:** `npm run test:p01-w3-4` · `npm run test:f01` · Vercel: copy `x-request-id` from failed chat → find JSON line (no user text).

---

## Commands

```bash
npm run test:p01
npm run test:p01-w3-4
npm run test:p01-w3-6
npm run test:p01-w3-5
npm run test:p01-w3-1
npm run test:f01
npm run test:f02c
npm run bench:f02b
npm run test:f08e
npm run test:f09
```
