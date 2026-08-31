# Aide — Open work (sequence)

**Single remaining backlog.** Shipped history → [`SHIPPED_FEATURES.md`](SHIPPED_FEATURES.md).  
**Do one track at a time.** Last update: Aug 30, 2026.

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
| **6** | **F10 Semantic RAG** | Only if KB pain | [`F10_SEMANTIC_RAG.md`](features/F10_SEMANTIC_RAG.md) |

---

## Deferred (do not start unless product insists)

| ID | Item | Why deferred |
|----|------|----------------|
| **UX-5** | OpenAPI import / flow canvas | Not required for DoD |
| **R6** | Redis for Actions scale | Neon/Postgres enough until load |
| **U6** | Desk multi-agent assign | Needs **L-TEAMS** |
| **L-*** | Billing, WhatsApp, SSO, … | [`ROADMAP_NEXT.md`](ROADMAP_NEXT.md) §4 · [`POST_MVP_BACKLOG_PLAN.md`](POST_MVP_BACKLOG_PLAN.md) |

---

## Sequence rule

```text
1 F00 live  →  2 F11-U live tick  →  5 F10 if needed  →  deferred/OOS
```

When an item ships: check it here, note in [`SHIPPED_FEATURES.md`](SHIPPED_FEATURES.md), keep this file short.
