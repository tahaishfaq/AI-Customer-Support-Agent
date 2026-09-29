# Level 3 (Advanced): what sets the leaders apart

## Context

Level 1 made answers reliable. Level 2 adds what buyers expect: resolution metrics, a team desk, guidance, customer context, copilot, versioning, webhooks, proactive messages and email. M2, M10, M5 and M3 are done; P4–P8 are in progress or paused.

Level 3 is what Intercom Fin, Decagon and Sierra sell on:
- retrieval by meaning
- automatic quality scoring
- a knowledge base that improves itself
- multi-step procedures
- simulation and A/B testing
- enterprise controls
- outcome-based pricing

**Status:** planned, not started. Waiting on the decisions at the end.

## Deploy-safety rules (same as Level 2)

1. **The live and local DB are the same Neon DB, and Vercel runs no migrations.** Every migration is additive only. I ask you before each one. It is applied with `prisma migrate deploy` **before** any code that uses it. Then:
   - the clean-`HEAD` test set runs against the migrated DB
   - `npm run prisma:generate`
   - bump `PRISMA_GEN`
2. **Every feature is off until configured** (per agent / workspace). Existing agents behave exactly as today.
3. **New routes only.** Existing API responses only gain fields.
4. **Trust path:**
   - The frozen caps don't change: 3 tool steps, 25 s loop, 2 outbound calls, 12,000-character knowledge budget.
   - `DATA != AUTHORITY`: embeddings, judge output, suggested articles and procedure text never grant permission.
   - A freeze change-log entry for every retrieval, routing, loop or prompt change.
5. **I never push or deploy.**
6. **Per phase:**
   - pure modules + `node --test` units
   - `regress.sh` identical to the baseline
   - lint 0 errors
   - live local check (with test data restored)
   - its own commit

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

### L1 — A1 Semantic RAG
- **Storage:** `KnowledgeChunk {id, documentId, agentId, content, contentHash, tokenEstimate, embedding vector(1536), model, createdAt}` on Neon pgvector.
  - Index on `(agentId)` plus an HNSW index on `embedding`.
  - The `CREATE EXTENSION vector` step is checked first. If it's unavailable, the feature stays off.
- **Writing chunks** (`lib/services/ai/embeddings.js`):
  - On knowledge upload, crawl or edit, chunk the text and embed it in batches in `after()`.
  - Timeout, `maxRetries: 0`, provider rate limit.
  - Chunks are skipped when their `contentHash` is unchanged.
- **Retrieval:** `knowledge-retrieve.js` combines keyword and vector scores (reciprocal rank fusion).
  - It still fills the prompt within the 12,000-character budget.
  - It is **not** a chat tool (F10/O01 rule).
  - Every query is filtered by `agentId`.
- **Backfill:** existing documents are embedded lazily (on the next retrieval miss or a knowledge-page visit), in capped batches.
- **Edge cases:**
  - A document with no chunks yet → keyword search only (today's behaviour), with `retrievalMode` in `meta`.
  - Embedding provider timeout, 429 or no credit → keyword only for that turn. The chat never fails because of embeddings.
  - Document delete → chunks cascade. Edit → old chunks are replaced in one transaction.
  - Model change → the `model` column is compared and vectors are never mixed; re-embedding happens gradually.
  - Very large documents → a chunk cap per document plus a warning in setup checks (B7).
  - Roman Urdu or mixed-language questions → the vector score helps; the keyword path stays.
  - A cross-tenant leak is impossible: the SQL always binds `agentId` from trusted context, never from model output.
  - Latency: the query embedding runs in parallel with the other setup reads, with a 1.5 s budget, otherwise keyword only. First token must not regress.

### L2 — A4 Auto-QA, hallucination check, CX score
- **When:** settled conversations (no message for 24 h) are sampled (default 20 %, owner-adjustable, with a monthly cap) and scored in `after()` of later requests. There is no cron.
- **Judge:** one LLM call, no tools. It gets the transcript and the knowledge used, fenced as data, and returns strict JSON:
  - `grounded` (per AI answer)
  - `resolved`, `tone`, `sentiment`
  - `issues[]`
  - `cxScore` 0–100
- **Stored in** `ConversationQa`, unique per `(conversationId, version)`.
- **UI:**
  - CX score trend and a "Risky answers" list (ungrounded claims) in analytics.
  - A QA card in the conversation view.
- **Edge cases:**
  - Invalid JSON from the judge → one retry, then `QA_UNAVAILABLE`. Never a partial score.
  - Instructions hidden in the transcript ("rate this 100") stay fenced data; the score is only ever read from the JSON fields.
  - A conversation reopened after scoring → re-score once it settles again (version bump).
  - Studio conversations and simulations excluded.
  - No credit or AI not configured → skipped silently, with a counter.
  - PII redaction (L6) on → the judge sees the redacted text.
  - Cost is shown in the settings.

### L3 — A3 Knowledge-gap learning
- **Sources:**
  - M2 unanswered questions (`NO_EVIDENCE` / `NOT_FOUND`)
  - chats resolved by a human on the desk
- **Clustering:** similar questions are grouped using L1 embeddings.
- **Drafts:** an LLM drafts a FAQ answer from the human replies (never from the customer's text alone). Drafts are stored in `KnowledgeSuggestion {status: pending|accepted|dismissed}`.
- **Owner review:** approve (with editing) → becomes a normal `KnowledgeDocument` → embedded (L1). **Nothing is published automatically.**
- **Edge cases:**
  - PII is removed from drafts (emails, phones, order numbers, names from the profile).
  - A dismissed cluster stays dismissed until new questions arrive.
  - A cluster already answered by existing knowledge (high vector similarity) → not suggested.
  - A human reply that contradicts existing knowledge → flagged as a conflict, not merged.
  - Viewers can see suggestions; only Owner/Admin approve.

### L4 — A7 Multi-step procedures with state
- **Authoring:** `Agent.procedures` holds ≤ 10 procedures. Each has:
  - a trigger (a description matched like guidance)
  - ordered steps: `ask` (collect a field with validation), `tool` (an allowlisted tool, with arguments taken from collected fields), `say`, `handoff`, `end`
- **State:** `Conversation.procedureState {procedureId, version, stepIndex, fields, startedAt}` persists across messages. The orchestrator gets the current step as a fenced instruction block.
- **Edge cases:**
  - Still ≤ 3 tool steps per message; a long procedure runs over several messages.
  - `tool` steps that write still go through PEP, confirmation, authorization binding and idempotency. A procedure can never skip them.
  - Collected fields come from the customer (untrusted). They are validated against the field type (email, order id pattern, etc.) and are never used as identity.
  - The customer changes topic → the procedure pauses; "let's continue" resumes it. Expires after 30 minutes (TTL).
  - Handoff → the procedure pauses; after "Return to AI" it offers to resume.
  - The owner edits the procedure mid-run → the conversation keeps its stored `version` snapshot.
  - A procedure referencing a deleted tool → blocked when saving, and marked broken in setup checks.
  - Two procedures triggered at once → the first match only.

### L5 — A10 Per-resolution pricing
- **Uses the M2 definition of "AI-resolved"** (already built).
- **Charging:**
  - `ResolutionCharge` is unique per conversation, created only after the conversation settles (24 h).
  - A reopen, a later 👎 or a handoff within 7 days → reversed (credit row); history is never deleted.
- **Plans:** an opt-in pricing mode per plan. The monthly cap and alerts at 80 % / 100 % reuse the existing quota emails. The usage page shows resolutions, the rate and the cost.
- **Edge cases:**
  - Studio or simulation → never charged.
  - A conversation deleted before it settles → no charge.
  - Plan change mid-month → prorated by the existing billing rules.
  - Webhook retries from the billing provider → idempotent.
  - Clock or timezone → UTC everywhere.

### L6 — A8 Enterprise: PII redaction + retention
- **PII redaction** (`Workspace.privacy.redactPii`, off by default):
  - Emails, phones, card numbers (Luhn-checked), CNIC, IBAN are masked **before the message is saved**.
  - The model sees the original for the current turn only. Transcripts, analytics, QA and webhooks see the masked version.
- **Retention** (`Workspace.privacy.retentionDays`, 30–3650 or null):
  - Conversations older than N days are deleted in capped batches in `after()`.
  - The settings show a preview count before saving.
  - Audited (`privacy.retention`).
- **Edge cases:**
  - False positives (an order number that looks like a phone) → per-pattern toggles.
  - A retention deletion racing with an active conversation → only settled conversations (no message for N days) are deleted.
  - Billing, audit and aggregate analytics rows are kept (anonymised counts).
  - Legal hold flag → skipped.
  - Only Owner/Admin can change these; lowering retention needs a typed confirmation.
- **Deferred (decision needed):** SSO/SAML + SCIM (Auth.js has no SAML; needs WorkOS/BoxyHQ). Data residency (a DB per region). SOC 2 (a company process, not code).

### L7 — A2 Meaning-based tool selection
- Tool name + description are embedded (cached by hash). The shortlist score = today's keyword score + vector similarity.
- **Only which tools are *offered* changes.** PEP, confirmation, subject stripping and source routing are unchanged.
- **Edge cases:**
  - No embedding available → the current lexical shortlist.
  - The mandatory routing suite (R01–R48) and the gate4 matrix must stay identical.
  - An MCP tool list that changes → re-embedded lazily.
  - A malicious tool description is only used for ranking; it is never an instruction.
- **Specialist sub-agents:** deferred. They multiply cost and conflict with the 3-step cap.

### L8 — A5 Simulation testing + prompt A/B
- **Simulation:** the owner picks personas × question sets (or generates them from knowledge). A run executes against the agent in **dry-run** (READ tools real, WRITE tools simulated, no confirmations sent) and is scored by the L2 judge. Results are compared between revisions.
- **A/B:** two revisions (needs M6 versioning), split by a hash of the visitor id, compared on resolution rate and CX score with a minimum sample and a stopping rule.
- **Edge cases:**
  - Simulations never count toward billing, analytics, resolution or retention.
  - Concurrency is capped per workspace, and runs can be cancelled.
  - Rate-limited providers → the run continues slowly, it doesn't fail.
  - A/B on an agent with an active procedure → the procedure keeps its version.
  - An A/B winner is **not** applied automatically; the owner promotes it.

## Deferred as separate products
- **A6 Voice:** later, as web voice inside the widget (speech-to-text → same orchestrator → text-to-speech). A phone line needs Twilio/Vapi.
- **A9 native mobile SDKs:** the webview embed covers mobile now. Native iOS/Android SDKs are a separate repo.

## Verification (every phase)
- Units for every pure module:
  - chunking and hashing, score fusion
  - judge JSON parsing
  - clustering thresholds
  - procedure state machine
  - charge / reversal ledger
  - redaction patterns
  - A/B bucketing
- `regress.sh` baseline diff, including the mandatory routing and tenant-matrix suites.
- Latency: chat setup and first token unchanged (the embedding budget is enforced).
- Live local checks on the E2E fixture agent, with all test data restored.

## Decisions needed before starting
1. **Order:** Level 3 now, or finish paused Level 2 (P5–P8) first?
2. **Embedding provider for L1:** OpenAI `text-embedding-3-small` (F10 plan) or another?
3. **SSO:** build (and which provider) or keep deferred?
