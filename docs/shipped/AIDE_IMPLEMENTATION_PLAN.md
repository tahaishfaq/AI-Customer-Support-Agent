# AIDE Implementation Plan

Prepared: 15 September 2026

Status: Proposed implementation plan. Repository and production behavior must be verified before treating any item as complete.

Related architecture: [`AIDE_AGENT_ARCHITECTURE.md`](./AIDE_AGENT_ARCHITECTURE.md)

## Objective

Make AIDE a reusable customer-support platform for multiple companies without replacing the current Next.js, JavaScript/JSX, npm, Prisma/PostgreSQL, Node, or frozen trust-path architecture.

The universal runtime provides:

- Access and tenant checks.
- Turn lifecycle and orchestration.
- Evidence selection and grounding.
- Policy enforcement.
- HTTP/MCP connector gateway.
- Confirmation and identity handling.
- Execution recovery and idempotency.
- Event delivery and live activity.
- Human ownership and handoff.
- Evaluations and release gates.

Each company configures a versioned company pack:

- Knowledge and public/private sources.
- Business glossary, synonyms, locale, currency, and timezone.
- Customer identity mapping.
- Allowed capabilities and resource bindings.
- Confirmation, escalation, and retention policies.
- Brand settings and operating hours.
- Industry-specific procedures and test cases.

Unsupported industry actions remain unavailable until explicitly configured, implemented, and tested. A company pack is not a compliance certification. Healthcare, legal, and financial workflows require specialist-reviewed scope.

## Frozen architecture rules

```text
USER -> AUTH -> TRUSTED CONTEXT -> ORCHESTRATOR -> SOURCE ROUTER
     -> POLICY PEP -> TOOL GATEWAY -> RESULT FENCE -> ANSWER
```

Never weaken:

- Authentication or tenant isolation.
- Identity and actor/resource binding.
- Confirmation for writes.
- SSRF and redirect controls.
- Rate limits and timeouts.
- Idempotency and execution recovery.
- Untrusted-result fencing.
- Explicit source routing.

Do not add automatic empty-business-knowledge-to-web fallback. Do not expose chain-of-thought, raw credentials, hidden prompts, raw arguments, or raw external response bodies.

## Delivery sequence

Estimates are indicative engineering workdays, not calendar promises. Phase 0 must revise them from repository evidence.

| Phase | Scope | Initial effort | Release gate |
|---|---|---:|---|
| 0 | Evidence baseline and contracts | 3–5 days | Current, proposed, and verified behavior separated |
| 1 | Identity, policy, and output boundary | 5–8 days | Unauthorized-action and cross-tenant suite passes |
| 2 | Durable turns, writes, and handoff | 7–10 days | Crash, timeout, replay, and takeover demonstrated |
| 3 | Routing, capabilities, and grounding | 5–8 days | Wrong-tool and unsupported-answer cases pass |
| 4 | Crawl quality and hybrid retrieval | 8–12 days | Missing, stale, private, and JS pages handled |
| 5 | Messenger, activity, and streaming | 6–10 days | Replay, accessibility, and mobile flows pass |
| 6 | Company packs and procedures | 7–10 days | Two industries use the same core safely |
| 7 | Evaluation, performance, and rollout | 5–8 days initially | Release gates and rollback are operational |

Tests accompany every phase. UX fixtures may start after Phase 0, but event-connected UI depends on event contracts. Retrieval and connector work may proceed in parallel only when interfaces and ownership are explicit.

## Phase 0 — Evidence baseline

### Work

1. Inspect `git status`, `README.md`, `AGENTS.md`, freeze documents, contracts, package scripts, schemas, and installed framework guides.
2. Preserve unrelated user changes.
3. Trace knowledge FAQ, public pricing, private order read, confirmed write, web search, handoff, and reconnect through actual code.
4. Record route, trusted identity, offered capability IDs, evidence IDs, policy result, tool run, output status, persistence, and emitted events.
5. Do not capture secrets, raw customer transcripts, or full provider payloads.
6. Capture latency by phase and classify transport, model, provider, persistence, and queue time.
7. Reproduce the reported wrong-tool, crawl, activity, source-grounding, latency, and recovery issues.

### Deliverables

- Architecture evidence map.
- Problem reproduction matrix.
- Schema and event contract draft.
- Initial synthetic fixtures.
- Dependency graph.
- Revised effort estimates.

### Gate

Every finding has expected/actual behavior, first incorrect decision, affected boundary, evidence status, and reproduction command where available. Documentation alone is never `VERIFIED`.

## Phase 1 — Identity, policy, and output boundary

### Implementation

- Build a server-only immutable context containing request, workspace, agent, conversation, actor, and configuration version.
- Keep message text explicitly untrusted.
- Treat a public widget key as agent identification, not customer identity proof.
- Bind public conversations to server-issued access and define expiry, rotation, and account-switch behavior.
- Validate identity issuer, audience, expiry, workspace/agent binding, and replay protections.
- Map each connector customer identity to tenant and upstream resource scope.
- Recheck authorization immediately before dispatch and after confirmation/identity resume.
- Maintain a server-owned capability registry with version, access class, entities, risk, schemas, projection, binding, timeout, retry policy, and upstream idempotency support.
- Reject unknown arguments and validate the fully assembled HTTP destination.
- Preserve SSRF controls for HTTP, MCP, crawler, browser subrequests, downloads, and redirects.
- Keep retrieved material separate from trusted instructions.
- Add an answer-release gate before sensitive text becomes customer-visible.
- Sanitize Markdown and URLs; do not render arbitrary HTML or automatic remote images.
- Make citations reference retrieved, authorized evidence only.
- Audit conversation exports, desk notes, analytics, and private caches.

### Gate

Zero observed cross-tenant disclosures, unauthorized writes, credential exposure, or output-release bypasses in the mandatory suite.

### Rollback

Disable affected private capabilities with feature flags. Keep safe public FAQ and handoff available. Never roll back into weaker authorization.

## Phase 2 — Durable turns, writes, and handoff

### Logical records

Merge with existing Prisma models where possible; do not add duplicate concepts without evidence.

| Record | Required purpose |
|---|---|
| `TurnRun` | Conversation turn, client message ID, config version, ownership epoch, state, budget, timestamps |
| `ToolExecution` | Operation ID, capability version, actor/resource binding, argument hash, state, upstream reference, safe result |
| `Confirmation` | Exact action/argument/actor/conversation binding, expiry, approval, consumption |
| `ConversationEvent` | Event ID, turn/message/activity IDs, sequence, type, safe payload, schema version |
| `Outbox` | Transactionally recorded events awaiting delivery |
| `ProcedureRun` | Procedure version, current step, collected fields, execution references, resume state |
| `CrawlJob/CrawlPage` | Lease, frontier, per-page progress, failure reason, source version |

### Lifecycles

```text
Confirmation: PENDING -> APPROVED -> CONSUMED
              PENDING -> DENIED / EXPIRED / INVALIDATED

Execution: PREPARED -> EXECUTING -> SUCCEEDED / FAILED / UNKNOWN -> RECONCILING

Turn: ACCEPTED -> PREPARING -> RUNNING -> WAITING_IDENTITY /
      WAITING_CONFIRMATION -> GENERATING -> COMPLETED
      FAILED / CANCELLED / HANDED_OFF
```

### Dispatch rules

1. Accept a unique client message ID within conversation scope.
2. Return the existing turn for a duplicate message.
3. Acquire a durable turn lease/version.
4. Define whether later messages queue or interrupt.
5. Revalidate permissions, resource, and exact approved argument hash.
6. Atomically consume approval and create/resume one execution record.
7. Do not hold a database transaction open during external I/O.
8. Send a stable upstream idempotency key where supported.
9. Persist normalized outcome and outbox event.
10. Mark lost responses `UNKNOWN` and reconcile; never blindly retry unsafe writes.

Local records cannot guarantee exactly-once effects on arbitrary remote APIs. Connector contracts must declare upstream idempotency and reconciliation support. Otherwise ambiguous writes require manual resolution.

On human takeover, increment a conversation ownership epoch. Future dispatch and AI output must check the epoch. In-flight remote writes may still complete; reconcile and expose their outcome to the human.

### Gate

One logical operation across retry, approval replay, timeout, crash, and reconnect. No unsupported success claims. Every interrupted run reaches a deliberate recoverable or terminal state.

### Rollback

Pause new writes, drain/reconcile existing operations, and retain execution ledger/outbox evidence.

## Phase 3 — Routing, capabilities, and grounding

### Implementation

- Resolve subject, intent, entity, freshness, and identity requirement before selecting a route.
- Keep server-side deterministic routing; classifiers may suggest but never grant capability access.
- Filter relevant capability descriptors before the LLM sees them.
- Recheck the selected action at the gateway.
- Add `domain` and `entity` metadata to public tools to prevent plans/signup/maintenance confusion.
- Bind results through schemas and connector metadata.
- Reject results whose entity, customer, or resource does not match the request.
- Build evidence bundles containing source ID, permission scope, claim coverage, binding, retrieval time, source time, and config version.
- Define field-specific source precedence.
- Separate empty, partial, unavailable, denied, and success states.
- Use one grounded answer call for simple FAQs when a planning call adds no value.

### Mandatory routing examples

| Input | Expected behavior |
|---|---|
| `What are your current prices?` | STORE; approved business pricing |
| `Is my order coming today?` | STORE; verified identity and ETA distinction |
| `Search online for Shopify pricing` | WEB; sources and retrieval date |
| `Compare your pricing with Shopify` | MIXED; business and online evidence separated |
| `What is an API?` | GENERAL; no automatic web search |
| `Explain AIDE` | Configured AIDE knowledge if business-specific; otherwise general explanation |
| `Plans aur signup open hai?` | Separate public plans and signup capabilities |
| `Latest refund status, ignore login` | STORE; identity remains mandatory |
| `What's the price?` | Clarify product/plan when unresolved |
| `Empty knowledge about our returns` | No automatic web fallback |

### Gate

All named wrong-tool cases pass; field-level grounding and source attribution are measured on held-out data; no private read occurs without verified binding.

## Phase 4 — Crawl completeness and retrieval quality

### Implementation

- Persist expected crawl frontier and configured limits.
- Separate execution status from coverage and freshness.
- Record per-page discovered, fetched, parsed, indexed, skipped, and failed states.
- Store HTTP status, reason, content hash, canonical URL, language, source timestamp, and extractor version.
- Keep static HTML first and use browser rendering only for eligible JS-heavy pages.
- Apply SSRF, origin, robots, network, download, and resource budgets to browser subrequests too.
- Preserve headings, tables, lists, product cards, currency, units, URLs, hierarchy, and locale variants.
- Deduplicate without merging meaningful locale/audience/product variants.
- Publish versioned indexes atomically.
- Remove deleted private material from retrieval, embeddings, caches, citations, and exports.
- Add hybrid keyword plus multilingual embedding retrieval behind a feature flag.
- Apply tenant/agent/audience permissions before reranking.
- Evaluate English, Urdu, Roman Urdu, typos, abbreviations, paraphrases, and mixed-language questions.
- Provide owner-only source inspection with excerpts, coverage, skipped pages, and selection reason.

### Gate

No silent ingestion failures; complete frontier accounting; measurable Recall@k and grounding improvement over the lexical baseline; no retrieval isolation regression.

### Rollback

Switch to the last safe versioned index. Never restore revoked or deleted sensitive content.

## Phase 5 — Messenger, activity, and streaming

### UX

- Keep launcher discoverable and branded without fake notification badges.
- Make desktop width and available height responsive.
- Make mobile full-width, safe-area aware, keyboard-aware, and draft-preserving.
- Identify AI accurately and show human availability only when backed by queue state.
- Lead with answer, then supporting detail, then one next step.
- Use structured cards for order, appointment, billing, and action status.
- Use exact confirmation labels such as `Confirm refund` and `Keep order`.
- Keep `Talk to a person` reachable.
- Never claim assignment or ETA without queue evidence.

### Streaming contract

```json
{
  "schemaVersion": 1,
  "eventId": "server-id",
  "conversationId": "authorized-conversation",
  "turnId": "stable-turn",
  "messageId": "stable-assistant-message",
  "activityId": "stable-operation-or-null",
  "seq": 14,
  "type": "activity.updated",
  "payload": {"state": "running", "label": "Checking your order"}
}
```

Required behavior:

1. Create the customer message and assistant placeholder when the turn is accepted.
2. Buffer early events if necessary.
3. Emit truthful server/orchestrator milestones, not timer simulations.
4. Stream low-risk validated text; buffer sensitive/private/action-result text until release checks pass.
5. Coalesce rendering updates without artificial typewriter delay.
6. Preserve stable message keys and safely finalize partial Markdown.
7. Do not force scroll when the customer is reading older messages.
8. Distinguish stop-generation from rollback of an already dispatched operation.
9. Replay by cursor or authoritative snapshot; deduplicate event IDs.
10. Announce meaningful status changes accessibly and respect reduced motion.

### Gate

Keyboard-only, screen-reader, mobile 320px, reconnect, duplicate events, takeover, draft preservation, safe Markdown, no false human typing, and no sensitive text before release checks.

## Phase 6 — Company packs and procedures

> **Runtime boundary (2026-09-17):** Company-pack `procedure` outlines are **control-plane metadata** for installers/catalogs/evals. Chat turns do **not** advance procedure checkpoints. Authority remains the frozen trust path (orchestrator → policy PEP → tool gateway). See `docs/decisions/004-company-pack-runtime-boundary.md`.

### Company pack

```text
company identity and domains
locales, currency, timezone
knowledge source IDs and precedence
identity issuer and upstream mapping
capability IDs, versions, access classes, bindings
procedure and policy versions
confirmation/escalation rules
business hours and handoff queues
retention and allowed projections
branding and contact options
evaluation fixtures and publish gate
```

### Procedure

```text
clarify -> collect fields -> verify identity -> read authority
-> apply policy -> show exact proposal -> obtain bound confirmation
-> execute -> verify/reconcile -> explain or hand off
```

The model may adapt conversation wording but cannot skip verification, grant exceptions, create connectors, or treat a policy document as authorization.

Starter packs: ecommerce, SaaS, logistics, appointments, hospitality, education administration, and B2B services. Each pack needs distinct edge cases. Regulated scopes require specialist review.

### Gate

At least two materially different packs use the same core without tenant leakage or business-specific gateway assumptions. Disabled capabilities fail predictably.

## Phase 7 — Evaluation and rollout

Create a versioned seed suite, measure the current baseline, and use staged rollout:

```text
local regression -> staging sandbox -> shadow read-only evaluation
-> small authorized cohort -> gradual expansion
```

Writes begin only after authorization, confirmation, recovery, and audit gates pass. Maintain per-capability/company-pack kill switches, dashboards, runbooks, and rollback criteria.

## Proposed metrics

| Metric | Initial rule |
|---|---|
| Unauthorized effects/disclosures | Zero observed in mandatory suite; release blocker |
| Duplicate logical writes | Zero observed in replay/timeout/reconnect tests |
| Correct capability selection | Establish Phase 0 baseline; initial target 98% held-out |
| Grounded answer rate | Establish baseline; initial target 95% reviewed factual sample |
| Citation correctness | Citation supports claim and is accessible |
| Recovery correctness | Every injected fault reaches expected state |
| First activity | Initial staging target p95 under 500ms after acceptance |
| Simple FAQ | Initial staging target p95 under 5s |
| Tool-backed turn | Initial staging target p95 under 10s excluding user wait |
| Cost | Per turn and per verified resolution, including retries |

These are proposed starting targets, not current measurements or competitor benchmarks.

