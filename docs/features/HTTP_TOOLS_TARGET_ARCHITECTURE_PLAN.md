# HTTP Tools Target Architecture and Implementation Plan

Status: PROPOSED / planning only  
Created: 2026-09-09  
Scope: repository HTTP tools, public embed authorization, reusable connections, immutable action publishing, response minimization, task orchestration, durable writes, and distributed operations.

## 1. Purpose and target outcome

The current system already has a guarded AgentAction path. The target is to evolve it into:

Connection → Action → Task → Existing Orchestrator → Existing Gateway → Execution Records

The owner experience should become:

Connect my store → Enable order lookup and cancellation → Configure customer verification → Test → Publish

Raw HTTP settings remain available in an Advanced editor. The model may propose an action or task step; the server remains the authority for identity, tenant, destination, permissions, confirmation, validation, credentials, and execution.

This document is an implementation plan, not an authorization to change code. Each phase must be implemented and reviewed separately.

## 2. Current repository baseline

### Existing foundations to preserve

- Gateway: lib/actions/invoke-tool.js
- Policy: lib/actions/policy.js
- Identity and subject binding: lib/actions/identity.js, identity-ttl.js, authz-binding.js
- Confirmation: lib/services/confirmation.service.js
- HTTP executor and SSRF: lib/actions/http-executor.js, ssrf.js, frozen-host.js
- Credentials: lib/services/credential.service.js, lib/actions/secrets.js
- Orchestrator: lib/orchestrator/index.js, loop.js
- Source routing: lib/services/ai/source-policy.js
- Result fence: lib/actions/untrusted-result.js
- Write idempotency: lib/actions/write-idempotency.js
- Execution audit: ToolRun and action.service.js
- Realtime persistence/outbox: lib/realtime/outbox.js and chat.service.js

### Current confirmed gaps

1. POST request body is not represented in AgentAction and is not passed to fetch.
2. Public conversation GET, confirmation, handoff, and feedback routes do not visibly use the same public conversation capability guard as chat continuation.
3. GET cache, rate limits, and outbound concurrency are process-local.
4. Action version is an integer, not an immutable revision/publish model.
5. Owner test responses return bounded downstream body text without field-level projection.
6. Input/output schema support is intentionally light rather than full JSON Schema.

Evidence: docs/audits/http-tools-current-state-audit.md.

## 3. Non-negotiable architecture rules

1. DATA != AUTHORITY. Model output, knowledge, web content, tool results, and user text cannot establish identity, tenant, credentials, confirmation, allowlists, or destinations.
2. The existing gateway remains the only execution path for HTTP, MCP, and built-in capabilities.
3. Owner-only action administration remains unchanged until a separate workspace-role decision is approved.
4. Existing AES-GCM credential encryption and workspace checks are preserved.
5. Published action revisions are immutable.
6. Public conversation routes must use an origin/customer/conversation-bound capability unless an explicitly anonymous endpoint is separately scoped and rate-limited.
7. No generic OAuth is introduced as a side effect of this plan. OAuth is a separate deliverable.
8. Private-network destinations remain unsupported for the public executor.
9. Synchronous actions are the first execution mode. Async/pending states are introduced only where the upstream contract requires them.
10. PostgreSQL is authoritative for durable operation/execution state. Redis is used for distributed short-lived coordination where deployment topology requires it.
11. Existing actions must migrate additively and must not silently gain broader access or invented request bodies.
12. Every phase ends with captured focused tests and an explicit exit gate.

## 4. Target domain model

### Connection

A workspace-owned integration destination and environment boundary. It owns:

- workspace and owner
- name and environment: sandbox or production
- enabled/disabled state
- base origin and allowed destination policy
- authentication mode and credential reference
- header policy
- health and last safe verification result
- current connection revision

Suggested entities:

- IntegrationConnection
- IntegrationConnectionRevision

Existing ActionCredential remains the encrypted secret store. Secrets must not be embedded in revision JSON.

### Action

One operation against one connection:

- stable action ID
- immutable revision ID
- business name and description
- method and path
- request content type
- typed input schema
- explicit parameter bindings
- structured request body template
- response schema
- response projection
- effect type: READ or WRITE
- identity/access/confirmation policy
- retry and idempotency policy
- connection revision
- publication metadata

AgentAction remains the compatibility-facing stable record during migration. New revision records become authoritative only after the controlled cutover gate.

### Task

A bounded business procedure containing approved action revisions:

- stable task ID and revision
- supported intent
- required identity level
- ordered or parallel steps
- typed output-to-input mappings
- confirmation checkpoints
- failure/handoff policy
- model-call, HTTP-call, parallelism, elapsed-time, and lifetime budgets

The first version uses structured task templates, not an arbitrary visual workflow builder.

### Execution records

Separate approval and execution state:

Approval:

PENDING → APPROVED / REJECTED / EXPIRED

Execution:

PREPARED → IN_FLIGHT → SUCCEEDED / FAILED / OUTCOME_UNKNOWN

Async upstream work may add PENDING_EXTERNAL.

Execution records must contain workspace, agent, conversation, verified principal, action/task revision, logical operation ID, request fingerprint, approval reference, attempt/lease metadata, upstream idempotency reference, outcome, and reconciliation state.

Sensitive args/results are not stored in ordinary logs. If recovery requires them, use restricted encrypted storage with retention.

## 5. Phase sequence

### Phase 0 — Baseline and contracts

Goal: remove unknowns before schema or execution migration.

Work:

- Record branch, commit, dirty-worktree state, Node/Next runtime, and deployment topology.
- Re-run the focused HTTP action, redesign, orchestrator, and edge suites.
- Verify developer-mode behavior, tool-pack storage/update, GET cache key, idempotency lease recovery, public capability format, and credential rotation semantics.
- Define sanitized synthetic fixtures for order lookup, appointment availability, and order cancellation.
- Document current configuration → outgoing request → normalized response for existing GET actions.
- Decide initial request formats: JSON and form-urlencoded.
- Decide synchronous execution as default and explicit pending state only where required.
- Confirm currently supported credential modes; keep generic OAuth separate.
- Confirm public executor rejects private-network destinations.

Affected documents:

- docs/audits/http-tools-current-state-audit.md
- docs/decisions/ new ADR for target model
- this plan

Tests:

- npm run test:f11
- npm run test:f11r
- npm run test:orchestrator
- node scripts/test-f11-edge-registry.mjs --all
- fixture contract tests with no external calls

Migration and rollback:

- No production schema change.
- If a baseline finding conflicts with this plan, update the ADR before Phase 1.

Exit gate:

Every current HTTP action storage and execution path is identified; assumptions are documented; no capability is invented.

### Phase 1 — Public access and authorization

Goal: close public-route inconsistency before redesign.

Backend:

- Consolidate public conversation access verification into a reusable server guard.
- Validate public agent, conversation, visitor/customer session, expiry, revocation, token scope, tenant/agent binding, and origin where applicable.
- Apply the guard to conversation retrieval, confirmation read/submit, handoff, feedback/CSAT where session access is required, SSE subscription/reconnect, and other public conversation mutations.
- Keep anonymous feedback only if explicitly approved; scope it to no transcript/action access, message-level capability, abuse controls, and clear product documentation.
- Never trust browser customerId as identity.
- Treat email/order number as input, not verification.
- Preserve owner-only tool management.

Likely files:

- app/api/public/agents/[publicKey]/conversations/[conversationId]/route.js
- app/api/public/agents/[publicKey]/confirmations/**
- app/api/public/agents/[publicKey]/conversations/[conversationId]/handoff/route.js
- app/api/public/agents/[publicKey]/feedback/route.js
- public access service and shared public guard
- public realtime subscription routes

Tests:

- Missing, expired, revoked, wrong-conversation, wrong-agent, wrong-tenant, wrong-origin, and wrong-subject tokens.
- Confirmation replay and direct endpoint invocation.
- SSE reconnect without a valid capability.
- Another customer’s order and forged customerId.
- Valid guest, valid identified visitor, and valid owner flows.

Migration and rollback:

- No schema required if existing PublicConversationAccess is sufficient.
- Deploy guard and tests first; retain a feature flag only if valid existing embed clients need a short compatibility window.
- Rollback is code rollback, but do not restore tokenless transcript access in production without an explicit security decision.

Exit gate:

Unauthorized transcript access and confirmation/mutation paths are blocked; valid widget and realtime flows continue to work.

### Phase 2 — Request bodies and typed parameter binding

Goal: fix the Body-tab defect without weakening the gateway.

Data contract:

- requestContentType: JSON or form-urlencoded
- requestBodyTemplate: structured object/template
- inputSchema: allowed model/customer inputs
- parameterBindings: explicit source for every path/query/header/body value
- responseSchema
- responseProjection
- effectType: READ or WRITE

POST is not automatically WRITE. Effect type is explicit.

Allowed binding sources:

- fixed owner value
- validated action input
- verified customer identity
- trusted server tenant context
- previous authorized action result
- credential reference only in approved secret locations

Rules:

- Build JSON as structured data, never raw string concatenation.
- Preserve arrays, numbers, booleans, null, and absent optional values distinctly.
- Encode path/query values correctly.
- Reject unknown arguments.
- Model arguments cannot override trusted bindings.
- Enforce body size and nesting limits.
- Do not permit eval, arbitrary expressions, or JavaScript templates.

UI:

- Split the current Body tab into Request body and Test inputs.
- Show a synthetic request preview with masked headers and resolved non-secret values.
- Keep advanced raw mapping available but validate it with the same server contract.

Likely files:

- prisma/schema.prisma and additive migration
- lib/validations/actions.js
- lib/services/action.service.js
- lib/actions/http-executor.js
- lib/actions/tool-definitions.js
- components/customization/HttpToolDialog.jsx
- components/customization/ActionsForm.jsx

Tests:

- Typed JSON body with string, number, boolean, array, null, and optional values.
- Form-urlencoded serialization.
- Path/query encoding.
- Unknown argument rejection.
- Trusted identity/tenant binding cannot be overridden.
- Body size/nesting rejection.
- Invalid input makes zero network calls.
- Existing GET fixtures remain unchanged.

Migration and rollback:

- Add nullable request fields and preserve legacy GET behavior.
- Existing POST actions are migrated with no invented body; mark unsupported actions NEEDS_REVIEW.
- Dual-read old/new contracts during rollout.
- Roll back execution flag while retaining nullable columns.

Exit gate:

A synthetic POST receives the exact typed body; old GET actions remain compatible; invalid input never reaches the network.

### Phase 3 — Reusable connections and credential lifecycle

Goal: separate destination, environment, and credentials from individual actions.

Introduce, after schema review:

- IntegrationConnection: workspace, name, environment, enabled state, current revision.
- IntegrationConnectionRevision: base origin, allowed destinations, auth mode, credential reference, header policy, health verification.
- AgentAction connection reference.

Responsibilities:

- Sandbox/production separation.
- Shared credential reference.
- Fixed allowed origin and destination policy.
- Header precedence policy.
- Connection health and safe verification.
- Supported authentication mode.

Preserve existing credential encryption, masking, rotation, revocation, and workspace checks. A destination change creates a new connection revision and must not forward old credentials to a new host.

Authentication UX exposes currently supported API key, bearer, and other modes. Generic OAuth remains a later project.

Tests:

- One connection used by multiple actions.
- Cross-workspace reference rejection.
- Rotation without old/new secret exposure.
- Revocation blocks the next invocation.
- Destination change prevents credential forwarding across hosts.
- Explicit header precedence.

Migration and rollback:

- Add nullable connection references.
- Backfill each existing action to a legacy-compatible connection/revision.
- Invalid or ambiguous actions become NEEDS_REVIEW, never silently broadened.
- Keep legacy credential path until all actions are validated.

Exit gate:

One connection safely serves multiple actions; cross-workspace references fail; rotation/revocation tests pass.

### Phase 4 — Immutable action revisions and publishing

Goal: isolate live edits, approvals, and running executions.

Lifecycle:

Draft → Validated → Published → Retired

Published revision is immutable; editing creates a new draft.

Store:

- stable action ID and revision ID
- configuration/schema hash
- connection revision
- input/output contract
- projection and access policy
- confirmation/retry/idempotency policy
- author and publication time

Publish checks:

- valid bindings
- configured/authorized connection
- required customer identity strategy
- private-resource authorization
- response projection
- declared side effects
- valid confirmation policy
- current configuration hash represented in test evidence

Runtime:

- New execution selects published revision.
- Pending execution pins its revision.
- Disable, revoke, and emergency kill switch are rechecked immediately.
- Rollback changes the published pointer; historical runs remain unchanged.
- Approval cannot be reused for another revision or args hash.

Migration:

- Add nullable revision tables/fields.
- Backfill legacy-compatible revisions.
- Compare old/new normalized contracts using fixtures.
- Switch by controlled cohort.
- Remove legacy fields only after rollback window and verification.

Tests:

- Published revision immutability.
- Edit creates a draft.
- In-flight run keeps its revision.
- Rollback does not alter historical ToolRun.
- Stale approval cannot execute a different revision.
- Resumable/idempotent backfill.

Exit gate:

Published edits cannot change an ongoing run; no secret is duplicated in plaintext; rollback and backfill are repeatable.

### Phase 5 — Response minimization and diagnostics

Goal: prevent unnecessary downstream data from reaching the model, browser, logs, or audit.

Pipeline:

- enforce transport and decompressed size limits
- check content type
- parse response
- apply bounded declarative projection
- validate projected result
- redact prohibited fields
- return normalized untrusted result

Prefer field selection and simple mappings; defer arbitrary transformation code.

Normalized outcomes:

- SUCCEEDED
- NO_RESULT
- VALIDATION_FAILED
- AUTH_REQUIRED
- FORBIDDEN
- RATE_LIMITED
- UPSTREAM_FAILED
- OUTCOME_UNKNOWN
- PENDING

Owner diagnostics show category, request ID, duration, sanitized status, failed mapping field, and next step. Production bodies stay hidden; preview uses synthetic or selected/redacted fields.

Tests:

- Content-type mismatch.
- Compressed/oversized response.
- Missing/type-invalid projected fields.
- Token, unrelated customer, forbidden, and unselected fields never reach model/UI/logs.
- Empty lookup becomes NO_RESULT, not transport failure.

Exit gate:

Sensitive and unrelated data is minimized across model context, preview, logs, and errors.

### Phase 6 — Owner experience redesign

Goal: common integrations require no raw HTTP knowledge.

Navigation:

- Connected systems
- Agent actions
- Tasks
- Activity and health

Guided flow:

1. Select known system or Custom API.
2. Connect with sandbox/production choice.
3. Enable business actions such as check order, find appointment, create ticket, cancel eligible order.
4. Select customer access level and confirmation.
5. Test with readable trace.
6. Publish with blocked-requirements summary.

Advanced mode edits method/path, typed inputs, request mappings, response fields, access bindings, and bounded retry/timeout settings. Simple and advanced modes edit the same contract.

Tool packs become versioned bundles with connection types, owner fields, permissions, sample tests, changelog, and upgrade diff. New write privileges require publication review.

Tests:

- Template setup without raw JSON.
- Custom GET setup.
- JSON POST setup.
- Failed credential recovery.
- Mobile/keyboard/accessibility checks for the guided flow.

Exit gate:

Nontechnical owner completes a template; developer configures custom actions without bypassing safeguards.

### Phase 7 — Multi-tool tasks

Goal: predictable bounded business procedures.

Task revision contains supported intent, identity requirement, allowed action revisions, dependencies, typed output-to-input mappings, confirmation checkpoints, failure/handoff policy, and budgets.

Execution rules:

- independent reads may run in bounded parallelism
- dependent reads are sequential
- read → verify → confirm → write is explicit
- multiple writes are sequential by default
- every step outcome persists
- missing identity pauses
- ambiguous resource asks the user
- dependency bindings consume only successful validated results
- each model call ID receives its matching result

Separate budgets: model iterations, HTTP calls, parallel requests, active execution time, total task lifetime. Confirmation waiting does not consume active HTTP deadline.

Human handoff persists identity state, completed actions, pending/unknown writes, required input, and safe execution references.

Tests:

- order plus delivery
- verify then cancel
- independent reads
- partial read failure
- two-write flow
- confirmation pause/reconnect
- mismatched tool-call IDs

Exit gate:

Deterministic mock services pass dependent, parallel, partial-failure, confirmation, and handoff workflows.

### Phase 8 — Durable writes and recovery

Goal: handle duplicate writes, lost responses, and worker crashes without claiming exactly-once delivery.

Execution state:

PREPARED → IN_FLIGHT → SUCCEEDED / FAILED / OUTCOME_UNKNOWN

Durable record includes workspace, agent, conversation, verified principal, action/connection revision, logical operation ID, request fingerprint, approval, attempt/lease, upstream idempotency reference, outcome, and reconciliation status.

Rules:

- same logical operation uses same key
- intentional new operation uses new key
- fingerprint includes resolved body/resource/revision
- scope key by tenant/principal
- database lease expiry alone never authorizes blind resend
- unknown outcome requires reconciliation or handoff
- confirmation binds exact principal, resource, revision, resolved arguments, and expiry

Tests:

- success with lost response
- crash before and after dispatch
- duplicate customer message
- two tabs
- expired lease
- replayed confirmation
- legitimate repeated operation

Exit gate:

Unknown outcomes cannot trigger blind retries; no unsupported exactly-once guarantee is documented.

### Phase 9 — Distributed reliability

Goal: consistent controls across replicas.

Use Redis or equivalent distributed coordination where deployment topology requires it for workspace quotas, connection concurrency, customer abuse limits, short-lived execution leases, and upstream backoff. PostgreSQL remains authoritative for durable execution.

Cache:

- default sensitive reads uncached
- key includes tenant, principal/access scope, connection/action revision, normalized args
- never share customer-specific results by URL alone

Retry:

- one component owns retry decisions
- bounded selected transient read retries
- writes retry only with safe idempotency/reconciliation
- honor upstream retry hints within deadline
- no retry for auth/schema failures

Failure behavior:

- coordination unavailable: protected writes fail closed
- optional cache unavailable: bypass cache
- database unavailable: no write without durable record
- upstream unhealthy: clear message and handoff option
- circuit breakers are tenant/connection scoped

Tests:

- two-node aggregate limits
- lease recovery
- Redis outage
- no cross-customer cache leakage
- broken credential does not disable unrelated tenants

Exit gate:

Replicas respect configured limits and recover leases without duplicate protected writes.

### Phase 10 — Production rollout and acceptance

Deployment order:

1. Public-route authorization fixes.
2. Additive migrations.
3. Contract/connection support behind scoped flags.
4. Backfill and validate legacy actions.
5. Internal read-only actions.
6. Selected customer reads.
7. Sandbox confirmed writes.
8. Recovery and multi-node tests.
9. Selected production integrations.
10. Gradual expansion.
11. Remove compatibility only after rollback window.

Never replay production writes in shadow mode. Compare request construction using fixtures.

Kill switches:

- platform
- workspace
- connection
- action
- writes-only emergency disable

Disabling dispatch does not cancel an in-flight upstream write; reconciliation continues.

Monitor setup/test/publish failures, authorization denials, latency, schema/projection failures, upstream 401/403/429/5xx, unknown writes, duplicate suppression, reconciliation, handoff, and connection health. Use execution IDs; exclude secrets and unnecessary customer data.

Final acceptance:

- every sensitive public route authenticates conversation access
- model cannot override identity, tenant, credentials, or destinations
- typed JSON POST works end to end
- all execution surfaces use the same gateway
- published revisions are immutable
- connection/credential revocation takes effect
- customer output is minimized and scoped
- dependent/independent tasks behave correctly
- confirmation/execution state survives reconnect/restart
- unknown writes cannot blindly retry
- replicas respect global limits
- guided setup works without raw HTTP knowledge
- legacy migration does not broaden access

## 6. Release grouping

| Release | Phases | Outcome |
|---|---|---|
| A — Secure foundation | 0–2 | Baseline verified, public authorization fixed, typed request bodies working |
| B — Reusable integrations | 3–6 | Connections, published actions, safe responses, guided owner UX |
| C — Reliable tasks | 7–8 | Bounded procedures and durable write recovery |
| D — Scale and rollout | 9–10 | Distributed controls and controlled production adoption |

## 7. PR and evidence rules

Each phase gets a separate reviewable PR and must include:

- migration and compatibility note where applicable
- affected file map
- focused unit/contract tests
- authorization-negative tests
- malformed-input and retry/idempotency tests where relevant
- captured exit-gate evidence
- rollback procedure
- no secrets or production payloads

The first implementation deliverable is Phase 0 plus Phase 1. The central architecture change remains Connection–Action–Task, executed through the existing orchestrator and gateway.

