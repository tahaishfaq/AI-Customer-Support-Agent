# Level 3 · Advanced — shipped archive

**Status:** Done (L1–L8). Features stay **off until configured** (per agent / workspace).  
**Plan (active notes + follow-ups):** [`../claude/LEVEL_3_ADVANCED_PLAN.md`](../claude/LEVEL_3_ADVANCED_PLAN.md)  
**Competitive audit (gaps vs Fin/Decagon/Sierra/Zendesk):** [`../claude/COMPETITIVE_DEEP_AUDIT.md`](../claude/COMPETITIVE_DEEP_AUDIT.md)  
**Trust path:** [`../ARCHITECTURE_FREEZE_STAGE6.md`](../ARCHITECTURE_FREEZE_STAGE6.md)

Do not treat this file as the open backlog. Next improvements live in the competitive audit + `OPEN_SEQUENCE.md`.

---

## What shipped

| Phase | Feature | User feel | Key surfaces |
|---|---|---|---|
| **L1** | Semantic RAG (Neon pgvector) | Meaning-based retrieve when owner enables hybrid; keyword fallback if embed fails | `embeddings.service.js`, `KnowledgeChunk`, Knowledge Semantic RAG panel |
| **L2** | Auto-QA / CX score | Sampled settled chats get a quality score; inbox QA card | `qa.service.js`, `ConversationQa`, QA settings dialog, analytics QA panel |
| **L3** | Knowledge-gap suggestions | Unanswered clusters → draft FAQ for Owner/Admin approve (never auto-publish) | `knowledge-suggestion.service.js`, Knowledge suggestions panel |
| **L4** | Multi-step procedures | Ask → tool → say / handoff workflows with first-match trigger | `procedures.js`, ProceduresEditor on Edit agent |
| **L5** | Per-resolution pricing | Ledger + schedule/reverse; plan flags default off; billing strip when opt-in | `ResolutionCharge`, `ResolutionUsageStrip`, `/api/billing/resolution-usage` |
| **L6** | PII redaction + retention | Redact before persist; retention days; inbox Privacy dialog | `privacy/redaction.js`, PrivacySettingsDialog |
| **L7** | Meaning-based tool shortlist | Optional embed shortlist of tools; PEP/routing unchanged | `tool-embedding.service.js`, `semanticToolShortlist` |
| **L8** | Simulation + A/B helpers | Dry-run questions (no billing); prompt A/B buckets; **never auto-promote** | SimulationPanel, AbExperimentPanel, `/api/agents/[id]/simulations`, `ab-stats` |

**Deferred (not in this ship):** Voice (A6), native mobile SDKs (A9), SSO/SAML + SCIM, data residency, SOC 2, WhatsApp (Level 2 M7).

---

## Migrations (additive)

- `prisma/migrations/20261003120000_level3_l1_l4`
- `prisma/migrations/20261003180000_level3_l5_l8`

Apply with `prisma migrate deploy` before promoting code that depends on them. Neon + Vercel: no auto-migrate.

---

## Tests

```bash
npm run test:level3-l1-l4
npm run test:level3-l5-l8
```

Embedding provider: OpenAI `text-embedding-3-small` (1536-d).

---

## Deploy-safety (same as Level 2 / freeze)

1. Features off until configured — existing agents behave as before.
2. New routes / additive fields only on existing APIs.
3. Frozen caps unchanged: 3 tool steps, 25s loop, 2 outbound, 12k knowledge budget.
4. `DATA != AUTHORITY`: embeddings, judge output, suggestions, procedure text never grant permission.
5. A/B never auto-promotes; restore winner via Version history.

---

## Related product surfaces also strengthened in the same era

- Email inbound channel UX (`EmailChannelPanel`, inbound docs)
- Neon pool connect timeouts + safe `getPlatformSettings` stale cache
- Embed readiness for email/embed identity

See also: [`EMAIL_INBOUND_CHANNEL.md`](EMAIL_INBOUND_CHANNEL.md).

*Archived: 2026-10-05.*
