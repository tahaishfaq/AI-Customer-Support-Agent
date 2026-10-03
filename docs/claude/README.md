# Claude plans — Aide product levels

Plans written with Claude Code on branch `sami` (2026-09). Each level builds on the one before.

| Level | Plan | Status |
|---|---|---|
| 1 · Basic (reliable answers) | [LEVEL_1_BASIC_PLAN.md](LEVEL_1_BASIC_PLAN.md) | ✅ Done (B1–B9) |
| 2 · Moderate (what buyers expect) | [LEVEL_2_MODERATE_PLAN.md](LEVEL_2_MODERATE_PLAN.md) | ✅ 8 of 9 done (M7 WhatsApp deferred) |
| 3 · Advanced (what leaders sell on) | [LEVEL_3_ADVANCED_PLAN.md](LEVEL_3_ADVANCED_PLAN.md) | ✅ L1–L8 shipped; L1–L4 checklist closed (features off until configured) |

## Level 2 progress

| Phase | Feature | Status |
|---|---|---|
| P1–P8 | Resolution, profile, guidance, desk, copilot, versioning, proactive, webhooks, email | ✅ |
| M7 | WhatsApp + connectors | ⏸ Deferred |

## Level 3 progress

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
