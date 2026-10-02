# Claude plans — Aide product levels

Plans written with Claude Code on branch `sami` (2026-09). Each level builds on the one before.

| Level | Plan | Status |
|---|---|---|
| 1 · Basic (reliable answers) | [LEVEL_1_BASIC_PLAN.md](LEVEL_1_BASIC_PLAN.md) | ✅ Done (B1–B9) |
| 2 · Moderate (what buyers expect) | [LEVEL_2_MODERATE_PLAN.md](LEVEL_2_MODERATE_PLAN.md) | ✅ 8 of 9 done (M7 WhatsApp deferred) |
| 3 · Advanced (what leaders sell on) | [LEVEL_3_ADVANCED_PLAN.md](LEVEL_3_ADVANCED_PLAN.md) | ⏸ Planned, waiting on decisions |

## Level 2 progress

| Phase | Feature | Status | Commit |
|---|---|---|---|
| P1 | M2 Resolution rate + unanswered questions | ✅ | `ef26c89` |
| P2 | M10 Verified customer profile | ✅ | `5db54be` |
| P2 | M5 Guidance rules | ✅ | `e3d4c6a` |
| P3 | M3 Team desk: assignment, least-busy routing, SLA | ✅ | `c658547` |
| P4 | M4 Copilot: suggest reply, AI summary | ✅ | `e512190` |
| P5 | M6 Versioning / restore | ✅ | `5657f31` |
| P6 | M9 Targeted proactive messages | ✅ | `9c14e73` |
| P7 | M8 Webhooks + API keys | ✅ | freeze + tests |
| P8 | M1 Email channel (Resend inbound) | ✅ | freeze + tests |

WhatsApp + connectors (**M7**) remain deferred to a later round.

## Level 3 decisions needed before starting

1. Order: Level 3 now, or finish Level 2 P5–P8 first?
2. Embedding provider for semantic RAG (L1): OpenAI `text-embedding-3-small` or another?
3. SSO/SAML: build (which provider) or keep deferred?

Trust-path changes from these plans are recorded in [ARCHITECTURE_FREEZE_STAGE6.md](../ARCHITECTURE_FREEZE_STAGE6.md).
