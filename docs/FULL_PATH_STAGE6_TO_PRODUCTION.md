# AIDE — Where We Stand & What’s Next

**Updated:** 2026-09-05  
**Engineering status:** Stages **1–6 complete** → **`CONDITIONAL_YES`** for production  
**Architecture:** **FROZEN** — [`ARCHITECTURE_FREEZE_STAGE6.md`](./ARCHITECTURE_FREEZE_STAGE6.md)  
**Sign-off:** [`PRODUCTION_READY_SIGNOFF.md`](./PRODUCTION_READY_SIGNOFF.md)  
**Ordered work:** [`OPEN_SEQUENCE.md`](./OPEN_SEQUENCE.md) · **Sockets:** [`features/SOCKET_REALTIME_PLAN.md`](./features/SOCKET_REALTIME_PLAN.md)  
**Harness scratch:** `.tmp/` (gitignored — regenerate with stage scripts if needed)

---

## 0. One-line stand

**Feature + trust architecture for the agent path is built and harness-green.**  
**Go-live is blocked on owner ops:** OpenAI billing, remaining manual confirm/billing, prod secrets/migrations — **not** on more Stage 3–6 feature work.  
**RAG 5.7 stays deferred** until knowledge quality is proven as the bottleneck.

---

## 1. Feature-wise comparison (demo project)

| Area | Before Stages 3–6 | Now (2026-09-05) | Stand |
| --- | --- | --- | --- |
| **Chat / knowledge** | Lexical stuffing; weak GENERAL when web off | Stuffing + language/style rules; GENERAL answers OK; Demo FAQ works | ✅ Ready for demo |
| **Store integrity** | Model could invent prices/stock | STORE FACTS + source router; empty → “cannot verify” | ✅ Strong |
| **Web search** | Missing / fake risk | OpenAI hosted `web_search`; stripped on STORE; MIXED sections | ✅ Wired; live A3 staging probe still required |
| **HTTP / MCP tools** | Tools with weak confirm | Gateway + SSRF + PEP + confirm lifecycle | ✅ Strong (harness) |
| **WRITE confirm** | Gaps / races | Atomic approve/claim, actor bind, TTL, consume | ✅ Harness PASS · ✅ Local Playwright UI smoke · ⬜ Production URL manual verification |
| **WRITE idempotency** | Easy double-create | Durable idempotency key + replay | ✅ Strong |
| **Authz** | Cross-user / agent leaks risk | Resource subject + conversation↔agent binding | ✅ Strong (manual C1/C2 PASS) |
| **Injection** | Tool/knowledge as authority risk | Untrusted fences; refuse jailbreaks | ✅ Strong (D1 PASS) |
| **Orchestrator waste** | Extra tool loops | Dedupe, early stop, strip WRITE on GENERAL/WEB | ✅ Strong |
| **Embed** | Snippet + widget | Deploy checklist + FYP local host works | ✅ Demo OK · live https checklist still grey until real site ping |
| **Auth product** | Login/register | + forgot/reset/verify email paths | ✅ Login smoke PASS · verify/forgot not fully exercised |
| **Billing** | Plans / SafePay / Atoms work | Plans UI + incomplete Popular checkout visible | ⬜ Full pay→webhook not finished |
| **Semantic RAG** | Not required by Stage 4 | Still deferred (F10) | ⏸ Last / only if needed |
| **Rate limits** | In-memory | Same (no Redis) | ⚠ **R6** · closes via Redis R3 |
| **Realtime** | HTTP fallback + Socket.IO client foundation | **Phase 2 in progress; one-port Node runtime** | 📋 [`SOCKET_REALTIME_PLAN.md`](./features/SOCKET_REALTIME_PLAN.md) |
| **OTP / profile / jobs** | Postgres OTP · sync/scripts | **No Redis/BullMQ** | 📋 [`REDIS_BULLMQ_ENTERPRISE_PLAN.md`](./features/REDIS_BULLMQ_ENTERPRISE_PLAN.md) |

---

## 2. Architecture-wise comparison

| Layer | Before | Now (frozen) |
| --- | --- | --- |
| Authority | LLM often “felt” in charge | **`DATA ≠ AUTHORITY`** — PEP/gateway own allow/deny/confirm |
| Path | Ad-hoc chat + tools | **USER → AUTH → CONTEXT → ORCHESTRATOR → SOURCE ROUTER → PEP → GATEWAY → FENCE → ANSWER** |
| Source | Prompt-only hints | Deterministic **STORE / WEB / GENERAL / MIXED** |
| Confirm | Soft / racy | **PENDING → APPROVED/CONFIRMED → CONSUMED** (+ deny/expire) |
| Caps | Loose | Frozen: max 3 tool steps, 25s loop, 2 outbound, etc. |
| Knowledge | Stuffing | Still stuffing (**not** vector RAG) — intentional |

Canonical modules: see freeze doc §3. **Do not redesign this path** unless CRITICAL.

---

## 3. What’s already done (no re-plan)

| Track | Done |
| --- | --- |
| Stage 1–2 | Architecture + agent validation baseline |
| Stage 3 | MCP confirm, hosted web search, store integrity |
| Stage 4 | Regression + security review (named P1/P2) |
| Stage 5.1–5.6, 5.8 | Confirm, fence, authz, lifecycle, router, idempotency, waste |
| Stage 5.7 | **SKIP / deferred** (accepted) |
| Stage 6.1–6.7 | Matrix, adversarial, perf, abuse, reliability, freeze, **CONDITIONAL_YES** |
| Manual (partial) | A1–A5, C1–C2, D1, E1, F1–F2, G1, G3 smoke; A5 prompt fix; Demo FAQ; hosted web staging probe pending |

Evidence: Stage 3–6 harnesses passed historically; local `.tmp/` reports are gitignored (re-run scripts to regenerate).

---

## 4. NEXT — do in this sequence only

```text
①  Verify production OpenAI billing/credits (local hosted-search probe already passes)
        │
②  ONE A3 chat only after the hosted web staging probe passes
        │     “Search the internet for today’s AI news”
        │     Expect: Online/web labeled answer · Called: web_search → OK
        │
③  B1–B4 confirm UI (studio, WRITE tool) — harness + local Playwright green; production URL manual check remains
        │     Confirm once → consume · no double · optional B5 TTL later
        │
④  Optional ONE A4 (store vs online) — only if ② green; costs another hosted search call
        │
⑤  G3 finish billing smoke (Continue checkout → SafePay test → webhook / cancel)
        │
⑥  Prod cutover checklist
        │     ACTIONS_IDENTITY_SECRET + ACTIONS_CREDENTIALS_KEY
        │     AUTH_URL HTTPS · prisma migrate deploy on prod
        │     Embed on real https site (checklist steps go green)
        │     Monitoring / error sampling agreed
        │
⑦  Flip PRODUCTION_READY_SIGNOFF → unconditional YES
        │
⑧  Redis R0–R3 + BullMQ R5 (OTP, profile, limits, email/billing workers)
        │     Detail: features/REDIS_BULLMQ_ENTERPRISE_PLAN.md
        │
⑨  Socket Phases 0–6 (outbox/gateway → desk → embed → presence → billing → hardening)
        │     Detail: features/SOCKET_REALTIME_PLAN.md
        │
⑩  LAST — Stage 5.7 Semantic RAG / MCP UX  ← only if still needed
```

**Do not:** re-run Stage 4–6 plans · put PEP/confirm on sockets/Redis · start RAG early · spam hosted search/OpenAI.

---

## 5. Pending checklist (owner)

### Blockers

| # | Item | Status |
| --- | --- | --- |
| P0 | Production OpenAI account has credits | ⬜ Local hosted-search probe passes; production account still owner-verified |
| P1 | Browser B1–B4 confirm UI | ✅ Local Playwright smoke; production URL manual verification required |
| P2 | Live A3 with hosted web search via chat | ⬜ Production URL/manual chat verification required |
| P3 | Billing pay → webhook complete | ⬜ Plans page only |
| P4 | Prod secrets `ACTIONS_*` | ⬜ Missing in sign-off scan |
| P5 | Prod migrations + HTTPS `AUTH_URL` | ⬜ |
| P6 | Live-site embed ping (not localhost) | ⬜ Checklist grey (expected) |

### Nice / later

| # | Item | Status |
| --- | --- | --- |
| N1 | G2 forgot/verify email full path | ⬜ |
| N2 | B5 confirm TTL (~10 min) | ⬜ |
| N3 | D2/D3 poisoned knowledge / junk web | ⬜ |
| N4 | Redis + BullMQ (OTP, profile, global limits, workers) | Deferred — [`REDIS_BULLMQ_ENTERPRISE_PLAN.md`](./features/REDIS_BULLMQ_ENTERPRISE_PLAN.md) |
| N5 | Semantic RAG 5.7 | Deferred — §6 |
| N6 | Desk/embed instant UX (sockets) | Deferred — after Redis R0 preferred |

### Already green (don’t redo unless regression)

A1, A4 (store half), A5, C1, C2, D1, F1, F2, G1 · hosted parser/provider tests · Stages 3–6 harnesses

---

## 6. Deferred — Stage 5.7 Semantic RAG (LAST)

Start **only if** after P0–P2:

1. Store/web/GENERAL routing still PASS, and  
2. Wrong answers are **wrong/missing knowledge chunks**, not OpenAI/confirm/web bugs.

Design: [`features/F10_SEMANTIC_RAG.md`](./features/F10_SEMANTIC_RAG.md)

---

## 7. Definition of unconditional YES

1. OpenAI hosted web-search chat path works (A3 once).  
2. Browser B1–B4 PASS (or accepted with harness + known flake doc).  
3. Billing test pay path OK.  
4. Prod secrets + migrations + live embed ping.  
5. Owner ticks boxes in [`PRODUCTION_READY_SIGNOFF.md`](./PRODUCTION_READY_SIGNOFF.md).  
6. RAG explicitly deferred or shipped with its own report.

---

## 8. Quick links

| What | Where |
| --- | --- |
| Architecture freeze | `docs/ARCHITECTURE_FREEZE_STAGE6.md` |
| Cond. sign-off | `docs/PRODUCTION_READY_SIGNOFF.md` |
| Open sequence | `docs/OPEN_SEQUENCE.md` |
| Socket plan | `docs/features/SOCKET_REALTIME_PLAN.md` |
| Redis + BullMQ | `docs/features/REDIS_BULLMQ_ENTERPRISE_PLAN.md` |
| TanStack Query (FE) | `docs/features/TANSTACK_QUERY_FRONTEND_PLAN.md` |
| Landing style pack | `docs/landing-style-pack/` |
| Hosted web-search probe | `scripts/probe-openai-web-search.js` |
| Full shipped suite | `npm run test:shipped` |

---

**Next action right now:** ① Top up OpenAI → ② one A3 → ③ B confirm UI.  
**After unconditional YES:** Redis R0 → … · FE cache can start Q0 in parallel.
