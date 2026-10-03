# Level 3 (Advanced): what sets the leaders apart

## Context

Level 1 made answers reliable. Level 2 adds what buyers expect: resolution metrics, a team desk, guidance, customer context, copilot, versioning, webhooks, proactive messages and email. M2, M10, M5 and M3 are done; M7 WhatsApp stays deferred.

Level 3 is what Intercom Fin, Decagon and Sierra sell on:
- retrieval by meaning
- automatic quality scoring
- a knowledge base that improves itself
- multi-step procedures
- simulation and A/B testing
- enterprise controls
- outcome-based pricing

## Current status (2026-10-03)

**L1–L8 are implemented.** Features stay **off until configured** (per agent / workspace). Existing agents behave as before.

| Phase | Feature | Status |
|---|---|---|
| L1 | A1 Semantic RAG | ✅ Done — checklist closed (lazy backfill, `retrievalMode`, keyword fallback) |
| L2 | A4 Auto-QA / CX | ✅ Done — checklist closed (conversation QA card, knowledge excerpts for judge, cost in settings) |
| L3 | A3 Knowledge-gap learning | ✅ Done — checklist closed (conflict flag, dismissed-until-new, Owner/Admin approve) |
| L4 | A7 Multi-step procedures | ✅ Done — checklist closed (runtime + rich step-builder UI) |
| L5 | A10 Per-resolution pricing | ✅ Done — ledger + schedule/reverse; plan flags default off |
| L6 | A8 PII redaction + retention | ✅ Done — inbox privacy dialog; redaction before persist |
| L7 | A2 Meaning-based tool shortlist | ✅ Done — `semanticToolShortlist`; PEP/routing unchanged |
| L8 | A5 Simulation + A/B helpers | ✅ Done — dry-run simulation panel; A/B bucket helpers (no auto-promote) |
| Deferred | A6 Voice, A9 native mobile SDKs, SSO/SAML + SCIM, data residency, SOC 2 | ⏸ Separate products / decisions |

**Migrations (additive, applied):**
- `20261003120000_level3_l1_l4`
- `20261003180000_level3_l5_l8`

**Tests:**
- `npm run test:level3-l1-l4`
- `npm run test:level3-l5-l8`

**Embedding provider:** OpenAI `text-embedding-3-small` (1536-d).  
**SSO/SAML:** still deferred.  
**Trust-path notes:** [`docs/ARCHITECTURE_FREEZE_STAGE6.md`](../ARCHITECTURE_FREEZE_STAGE6.md).

### Known follow-ups (not blockers)

- L5: buyer-facing strip on Billing when plan opts in (`ResolutionUsageStrip` + `/api/billing/resolution-usage`); separate invoice line still deferred.
- L8: A/B panel with min-sample stop cue + sample counts; promotion stays manual via Version history.
- Live E2E against the fixture agent after each deploy (unit suites are green).

---

## Deploy-safety rules (same as Level 2)

1. **The live and local DB are the same Neon DB, and Vercel runs no migrations.** Every migration is additive only. Ask before each one. Apply with `prisma migrate deploy` **before** any code that uses it. Then:
   - the clean-`HEAD` test set runs against the migrated DB
   - `npm run prisma:generate`
   - bump `PRISMA_GEN`
2. **Every feature is off until configured** (per agent / workspace). Existing agents behave exactly as today.
3. **New routes only.** Existing API responses only gain fields.
4. **Trust path:**
   - The frozen caps don't change: 3 tool steps, 25 s loop, 2 outbound calls, 12,000-character knowledge budget.
   - `DATA != AUTHORITY`: embeddings, judge output, suggested articles and procedure text never grant permission.
   - A freeze change-log entry for every retrieval, routing, loop or prompt change.
5. **Do not push or deploy** unless explicitly asked (push still needs an exact branch confirm).
6. **Per phase:**
   - pure modules + `node --test` units
   - `regress.sh` identical to the baseline when routing/retrieve changes
   - lint 0 errors
   - live local check (with test data restored)
   - its own commit when asked

## Phases (order = value × dependency)

| Phase | Feature | Migration | Depends on |
|---|---|---|---|
| L1 | A1 Semantic RAG (Neon pgvector) | `KnowledgeChunk` + `vector` extension | — |
| L2 | A4 Auto-QA, hallucination check, CX score | `ConversationQa` | L1 (grounding check) |
| L3 | A3 Knowledge-gap learning | `KnowledgeSuggestion` | M2, L1 |
| L4 | A7 Multi-step procedures with state | `Agent.procedures` (Json), `Conversation.procedureState` (Json) | — |
| L5 | A10 Per-resolution pricing | `ResolutionCharge` | M2 |
| L6 | A8 Enterprise: PII redaction + retention | `Workspace.privacy` (Json) | — |
| L7 | A2 Meaning-based tool selection | `ToolEmbedding` (or cached) | L1 |
| L8 | A5 Simulation testing + prompt A/B | `SimulationRun`, `SimulationCase` | L2, M6 (versioning) |
| Deferred | A6 Voice, A9 native mobile SDKs, SSO/SAML + SCIM, data residency, SOC 2 | — | separate products / decisions |

---

### L1 — A1 Semantic RAG — ✅ shipped

- **Storage:** `KnowledgeChunk {id, documentId, agentId, content, contentHash, tokenEstimate, embedding vector(1536), model, createdAt}` on Neon pgvector.
  - Index on `(agentId)` plus an HNSW index on `embedding`.
  - The `CREATE EXTENSION vector` step is checked first. If it's unavailable, the feature stays off.
- **Writing chunks** (`lib/services/ai/embeddings.service.js`):
  - On knowledge upload, crawl or edit, chunk the text and embed it in batches in `after()`.
  - Timeout, `maxRetries: 0`, provider rate limit.
  - Chunks are skipped when their `contentHash` is unchanged.
- **Retrieval:** lexical path + optional vector RRF (`selectKnowledgeHybrid`).
  - Still fills the prompt within the 12,000-character budget.
  - **Not** a chat tool (F10/O01 rule).
  - Every query is filtered by `agentId`.
- **Backfill:** ✅ capped lazy embed on knowledge-page visit and on retrieval miss (`scheduleKnowledgeBackfill`).
- **UI:** `SemanticRagPanel` — `Agent.semanticRagEnabled` (default off).
- **Edge cases (covered):**
  - No chunks yet → keyword only; studio response includes `retrievalMode` (`keyword` \| `hybrid`).
  - Embedding timeout / 429 / no credit → keyword only; chat never fails because of embeddings.
  - Document delete → chunks cascade. Edit → replace chunks.
  - Model column compared; vectors never mixed across models.
  - Large docs → chunk cap + B7 setup warning.
  - Cross-tenant leak impossible: SQL binds `agentId` from trusted context.
  - Query embed budget ~1.5 s; first token must not regress.

### L2 — A4 Auto-QA, hallucination check, CX score — ✅ shipped

- **When:** settled conversations (no message for 24 h) sampled (default 20 %, owner-adjustable, monthly cap) in `after()`. No cron.
- **Judge:** one LLM call, no tools. Transcript + knowledge excerpts fenced as data → strict JSON (`grounded`, `resolved`, `tone`, `sentiment`, `issues[]`, `cxScore`).
- **Stored in** `ConversationQa`, unique per `(conversationId, version)`.
- **UI:**
  - ✅ Analytics: CX trend + “Risky answers” (`QaPanel`).
  - ✅ Conversation details: QA card (`ConversationQaCard`).
  - ✅ Inbox settings: sample rate, monthly cap, **estimated monthly cost** (`QaSettingsDialog` + `estimateQaMonthlyCost`).
- **Edge cases (covered):**
  - Invalid judge JSON → one retry, then `QA_UNAVAILABLE`.
  - Transcript instructions stay data; score only from JSON fields.
  - Re-score on settle after new messages (version bump).
  - Studio / simulations excluded.
  - Offline / no credit → skip silently.

### L3 — A3 Knowledge-gap learning — ✅ shipped

- **Sources:** M2 unanswered (`NO_EVIDENCE` / `NOT_FOUND`) + human-resolved desk chats.
- **Clustering:** normalized key + optional L1 embeddings.
- **Drafts:** LLM FAQ from human replies only → `KnowledgeSuggestion` (`pending` \| `accepted` \| `dismissed`). Never auto-publish.
- **Owner review:** Accept (editable) → `KnowledgeDocument` + embed. UI: `KnowledgeSuggestionsPanel`.
- **Edge cases (covered):**
  - PII scrubbed from drafts.
  - Dismissed cluster stays dismissed until **new** source conversations arrive.
  - Already answered by knowledge (vector and/or lexical) → not suggested.
  - Contradictory human draft → `conflictWithDocumentId` flag (not auto-merged).
  - Viewers can list; only Owner/Admin (`canManage`) refresh / accept / dismiss.

### L4 — A7 Multi-step procedures with state — ✅ shipped

- **Authoring:** `Agent.procedures` ≤ 10. Trigger + ordered steps: `ask`, `tool`, `say`, `handoff`, `end`.
- **UI:** ✅ rich step builder on agent edit (`ProceduresEditor`) — not raw JSON only.
- **State:** `Conversation.procedureState {procedureId, version, stepIndex, fields, startedAt}` across messages; fenced instruction block for the orchestrator.
- **Edge cases (covered):**
  - ≤ 3 tool steps per message; long procedures span turns.
  - WRITE tools still go through PEP, confirmation, authz binding, idempotency.
  - Collected fields validated by type; never identity.
  - Topic change → pause; “let’s continue” resumes; 30-minute TTL.
  - Mid-run owner edit → conversation keeps stored `version`.
  - Missing tool → broken in setup checks; first matching trigger only.

### L5 — A10 Per-resolution pricing — ✅ shipped (ledger)

- Uses M2 “AI-resolved”.
- `ResolutionCharge` unique per conversation after settle (24 h); reverse within 7 days on 👎 / handoff / reopen.
- Plan flags `resolutionPricingEnabled` / price / monthly max default **off**.
- Studio / simulation never charged; idempotent schedule/reverse.
- **Follow-up:** richer usage/billing UI when a plan opts in.

### L6 — A8 Enterprise: PII redaction + retention — ✅ shipped

- `Workspace.privacy.redactPii` (off by default): emails, phones, cards (Luhn), CNIC, IBAN masked before persist; model may see original for the current turn only.
- `retentionDays` (30–3650 or null): capped `after()` deletes of settled chats; preview count; Owner/Admin only; lowering retention needs typed confirmation; legal hold skipped.
- UI: `PrivacySettingsDialog` in inbox.
- **Still deferred (product decisions):** SSO/SAML + SCIM, data residency, SOC 2.

### L7 — A2 Meaning-based tool selection — ✅ shipped

- Tool name + description embedded (cached by hash). Shortlist = lexical + vector when `semanticToolShortlist` is on.
- **Only offer ranking changes.** PEP, confirmation, subject stripping, source routing unchanged.
- No embedding → lexical shortlist. Routing suites must stay identical.
- Specialist sub-agents: deferred.

### L8 — A5 Simulation testing + prompt A/B — ✅ shipped (core)

- **Simulation:** owner runs personas × questions in dry-run (READ real, WRITE simulated, no confirmations); scored by L2 judge; excluded from billing / analytics / retention. UI: `SimulationPanel`.
- **A/B:** visitor-id hash bucketing helpers; winner **never** auto-applied.
- Concurrency capped; runs cancellable.
- **Follow-up:** fuller experiment UI (min sample / stopping rule) if buyers need it.

## Deferred as separate products

- **A6 Voice:** later, web voice in the widget (STT → same orchestrator → TTS). Phone line needs Twilio/Vapi.
- **A9 native mobile SDKs:** webview embed covers mobile now. Native iOS/Android SDKs are a separate repo.
- **SSO/SAML + SCIM:** Auth.js has no SAML; needs WorkOS/BoxyHQ (decision pending).
- **Data residency / SOC 2:** infra + company process, not this phase.

## Verification

| Check | Command / note |
|---|---|
| L1–L4 units | `npm run test:level3-l1-l4` |
| L5–L8 units | `npm run test:level3-l5-l8` |
| Pure coverage | chunk/hash, RRF, judge JSON, clustering + conflict, procedure state, charge window, redaction, A/B bucket |
| Routing / tenant | keep `regress.sh` / mandatory suites green when retrieve or shortlist changes |
| Latency | query-embed budget enforced; keyword fallback on miss |
| Freeze | change-log entries in `ARCHITECTURE_FREEZE_STAGE6.md` for L1–L4 and L5–L8 |

## Decisions (resolved)

1. **Order:** Level 3 built now; paused Level 2 M7 (WhatsApp) stays deferred.
2. **Embedding provider:** OpenAI `text-embedding-3-small`.
3. **SSO:** keep deferred until a provider decision.
