# Aide — Open work (sequence)

**Single remaining backlog.** Shipped history → [`SHIPPED_FEATURES.md`](SHIPPED_FEATURES.md).  
**Do one track at a time.** Last update: Aug 31, 2026.

---

## Now (owner + buffer)

| # | Item | Source leftovers | Done when |
|---|------|------------------|-----------|
| **1** | **F00 live DoD ticks + demo rehearsal** | F00 buffer | All DoD checks on live · script run · [`F00_PROGRESS.md`](features/F00_PROGRESS.md) |
| **2** | **F11-U owner live D3 tick** | Universal authz eng ✅ | Confirm guest/account tools + Brandly-style dual-auth on live |

---

## Next (engineering, after F00)

| # | Item | Notes | Done when |
|---|------|-------|-----------|
| **3** | ~~F12-U U4 — Internal notes~~ | ✅ Aug 30 | Agent-only note on thread; not sent to customer |
| **4** | ~~F12-U U5 — CSAT after resolve~~ | ✅ Aug 30 | Optional 1–5 after Return to AI / resolve |
| **5** | ~~P1 Week 3~~ | W3-1 · W3-3 · W3-7 ✅ | [`P01_WEEK3_PLAN.md`](features/P01_WEEK3_PLAN.md) |
| **6** | ~~O01 Orchestrator layer~~ | ✅ Aug 31 · O0–O5 + O3.1 | [`ORCHESTRATOR_LAYER_PLAN.md`](features/ORCHESTRATOR_LAYER_PLAN.md) · `npm run test:orchestrator` |
| **7** | **M01 MCP Tools UX** | After F00 live path; **do not** reopen O01 | [`MCP_DEEP_PLAN.md`](features/MCP_DEEP_PLAN.md) · ship: UX-1 → DS1 → UX-2 → R1 → M1… |
| **8** | **F10 Semantic RAG** | Only if KB pain; Agent-layer retrieve (not Orchestrator tools) | [`F10_SEMANTIC_RAG.md`](features/F10_SEMANTIC_RAG.md) |

---

## Deferred (do not start unless product insists)

| ID | Item | Why deferred |
|----|------|----------------|
| **B01** | Billing SafePay | Gate **above** Orchestrator — [`BILLING_SAFEPAY.md`](features/BILLING_SAFEPAY.md) |
| **E01** | Resend email | Independent of O01 — [`EMAIL_RESEND_PLAN.md`](features/EMAIL_RESEND_PLAN.md) |
| **F12-E/D** | Escalation + Desk gaps | Uses existing `request_handoff` capability — [`F12_ESCALATION_PLAN.md`](features/F12_ESCALATION_PLAN.md) |
| **UX-5** | OpenAPI import / flow canvas | Not required for DoD |
| **R6** | Redis for Actions scale | Neon/Postgres enough until load |
| **U6** | Desk multi-agent assign | Needs **L-TEAMS** |
| **L-*** | WhatsApp, SSO, … | [`ROADMAP_NEXT.md`](ROADMAP_NEXT.md) §4 · [`POST_MVP_BACKLOG_PLAN.md`](POST_MVP_BACKLOG_PLAN.md) |

---

## Sequence rule

```text
1 F00 live → 2 F11-U live tick → 7 M01 MCP (UX-1…) → 8 F10 if needed → deferred B01/E01/F12-E
```

**O01 invariant:** Billing / suspend / admin gates stay **above** Orchestrator. MCP / escalation product work must not fork `runTurn`.

When an item ships: check it here, note in [`SHIPPED_FEATURES.md`](SHIPPED_FEATURES.md), keep this file short.
