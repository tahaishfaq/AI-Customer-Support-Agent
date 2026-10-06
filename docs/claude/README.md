# Claude plans — Aide product levels

Plans written with Claude Code on branch `sami` (2026-09 / 2026-10). **All three levels are implemented.** Plans here are historical + notes; shipped archives live under `docs/shipped/`.

| Level | Plan (claude) | Shipped archive | Status |
|---|---|---|---|
| 1 · Basic | [LEVEL_1_BASIC_PLAN.md](LEVEL_1_BASIC_PLAN.md) | [`../shipped/LEVEL_1_BASIC.md`](../shipped/LEVEL_1_BASIC.md) | ✅ Done (B1–B9) |
| 2 · Moderate | [LEVEL_2_MODERATE_PLAN.md](LEVEL_2_MODERATE_PLAN.md) | [`../shipped/LEVEL_2_MODERATE.md`](../shipped/LEVEL_2_MODERATE.md) | ✅ P1–P8 (M7 WhatsApp deferred) |
| 3 · Advanced | [LEVEL_3_ADVANCED_PLAN.md](LEVEL_3_ADVANCED_PLAN.md) | [`../shipped/LEVEL_3_ADVANCED.md`](../shipped/LEVEL_3_ADVANCED.md) | ✅ L1–L8 (off until configured) |
| — · Competitive audit | [COMPETITIVE_DEEP_AUDIT.md](COMPETITIVE_DEEP_AUDIT.md) | — | 📋 Gaps vs Fin / Decagon / Sierra / Zendesk + speed plan |

**User catalog:** [`../SHIPPED_FEATURES.md`](../SHIPPED_FEATURES.md) · **Shipped index:** [`../shipped/README.md`](../shipped/README.md)

## Level 1 progress (done)

| # | Feature | Status |
|---|---|---|
| B1 | Tool typos + follow-ups | ✅ |
| B2 | Entity filter + not-found body | ✅ |
| B3 | Freshness → web | ✅ |
| B4 | Deferred handoff in multi-tool turns | ✅ |
| B5 | Reply language | ✅ |
| B6 | Support hours / offline handoff ack | ✅ |
| B7 | Agent setup readiness warnings | ✅ |
| B8 | Clear public chat access errors | ✅ |
| B9 | Prod Redis / realtime deploy notes | ✅ |

## Level 2 progress (done)

| Phase | Feature | Status |
|---|---|---|
| P1–P8 | Resolution, profile, guidance, desk, copilot, versioning, proactive, webhooks, email | ✅ |
| M7 | WhatsApp + connectors | ⏸ Deferred |

## Level 3 progress (done)

| Phase | Feature | Status |
|---|---|---|
| L1 | Semantic RAG | ✅ + lazy backfill, `retrievalMode` |
| L2 | Auto-QA / CX | ✅ + conversation QA card, judge excerpts, cost estimate |
| L3 | Knowledge-gap suggestions | ✅ + conflict flag, Owner/Admin approve |
| L4 | Procedures | ✅ runtime + rich step builder |
| L5 | Per-resolution pricing | ✅ ledger (`ResolutionCharge`), plan flags off by default |
| L6 | PII redaction + retention | ✅ Inbox privacy dialog |
| L7 | Meaning-based tool shortlist | ✅ `semanticToolShortlist` |
| L8 | Simulation + A/B helpers | ✅ Edit simulation panel + A/B bucketing |

Embedding provider: OpenAI `text-embedding-3-small`. SSO/SAML stays deferred.

Trust-path changes: [ARCHITECTURE_FREEZE_STAGE6.md](../ARCHITECTURE_FREEZE_STAGE6.md).

**Next (not a new level yet):** [COMPETITIVE_DEEP_AUDIT.md](COMPETITIVE_DEEP_AUDIT.md) P0 — hybrid default, crawl tick, stream TTFT.
