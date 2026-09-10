# HTTP Tools Current-State Architecture, Security, Reliability, and UX Audit

Audit date: 2026-09-09  
Repository: AI-Customer-Support-Agent  
Commit snapshot: 3e3042f8b4821d58d3c62ec6078d2fb97e92ee57  
Mode: read-only audit. Only this report is being created.

## 1. Executive summary

HTTP tools are implemented end to end in local code: owner CRUD, encrypted credentials, capability exposure, orchestration, policy/authz/confirmation, SSRF-safe execution, result fencing, ToolRun metadata, idempotency, and streamed tool/text activity. This is VERIFIED IN CODE and was VERIFIED BY EXECUTED TEST through F11, F11 redesign, orchestrator, and 1,000 edge cases.

The feature is not unconditionally production-ready. Confirmed priorities:

- HIGH: POST tools cannot send request bodies. The UI Body tab edits test arguments, AgentAction has no body field, and the executor fetch call has no body.
- HIGH: Public conversation retrieval, confirmation, handoff, and feedback routes do not visibly verify the origin/customer-bound public conversation access token, unlike chat continuation.
- HIGH for multi-node deployments: rate limits, GET cache, and outbound semaphore are process-local; the shipped docs explicitly defer Redis for this feature.
- MEDIUM/HIGH: action version is only an integer; no immutable revisions, draft/publish, approval, or rollback exists.
- MEDIUM: authenticated owner test responses return bounded downstream body text, with no field-level PII/secret projection.

The strongest components to preserve are the single server-side gateway, workspace credential scoping, AES-GCM storage, frozen-host plus DNS-pin SSRF checks, policy outside the LLM, atomic confirmation, durable write idempotency, untrusted-result fencing, bounded loops, and metadata-only audit rows.

Production status: CONDITIONAL. Repository evidence does not prove production migrations, dedicated secret configuration, multi-node coordination, or deployed public-route authorization.

## 2. Scope, snapshot, limitations

Inspected Prisma schema/migrations; action/credential routes and services; HTTP executor, templates, headers, SSRF, retries, timeouts, output checks, cache, semaphore, policy, identity, confirmation, idempotency, result fence, orchestrator, source routing, chat/embed/public routes, owner UI, and existing docs/tests.

The worktree was already dirty; existing changes were preserved. No .env values, credentials, database URLs, customer data, production tokens, deployment endpoint, paid model, external API, migration, seed, or webhook was used. Tests below are local contracts and do not prove deployed behavior.

Statuses: VERIFIED IN CODE; VERIFIED BY EXECUTED TEST; PARTIALLY IMPLEMENTED; DOCUMENTED ONLY; NOT FOUND IN INSPECTED SCOPE; UNKNOWN / BLOCKED.

## 3. Architecture and trust boundary

The frozen trust path is documented in docs/ARCHITECTURE_FREEZE_STAGE6.md:13-29.

Mermaid sequence diagram:

sequenceDiagram
  participant V as Owner or embed visitor
  participant A as Auth/public access
  participant C as Trusted context
  participant O as Orchestrator
  participant P as Policy PEP
  participant G as Tool gateway
  participant H as HTTP executor
  participant X as Downstream API
  participant F as Result fence
  participant D as PostgreSQL
  V->>A: authenticated chat or public request
  A->>C: agent/workspace/conversation/subject
  C->>O: runTurn
  O->>P: proposed allowlisted capability
  P->>G: permitted action after authz/identity/confirm
  G->>H: validated args and server credential
  H->>X: SSRF-safe HTTPS request
  X-->>H: bounded response
  H-->>F: result as data
  F-->>O: fenced untrusted result
  O-->>D: message plus realtime outbox and ToolRun metadata
  O-->>V: answer and optional SSE deltas

The DATA != AUTHORITY invariant is VERIFIED IN CODE in lib/actions/policy.js:43-127, lib/actions/untrusted-result.js:72-115, lib/actions/authz-binding.js:53-130, and lib/orchestrator/loop.js:85-92.

## 4. End-to-end execution trace

Owner configuration: POST action route authenticates and validates createAgentActionSchema (app/api/agents/[id]/actions/route.js:29-54); action.service.js:23-29 enforces owner access; action.service.js:31-54 stores frozen host/schema/risk/identity fields; credential.service.js and secrets.js keep credentials server-side with AES-GCM.

Execution: chat.service.js:794-818 calls runTurn. loop.js:172-231 applies source routing and capability filtering; loop.js:330-481 enforces deadline, max steps, deduplication, GET-first order, invocation, and streamed activity. invoke-tool.js:131-213 validates action/conversation/args; :231-343 applies policy/confirmation; :598-754 reloads action/credential and idempotency; :756-879 executes/audits.

HTTP: http-executor.js:27-109 resolves argument/env/credential templates; :351-399 checks frozen host and DNS-pin SSRF; :401-451 applies headers, credentials, timeout, and manual redirects; :453-503 caps response, checks configured top-level output keys, and returns safe status metadata.

Persistence: chat.service.js:59-134 writes messages and realtime outbox intent transactionally; ToolRun stores metadata only (invoke-tool.js:898-923; prisma/schema.prisma:451-475).

## 5. Owner journey and UX friction

Current journey is Agent → Customization → Tools/HTTP → Add/Edit → URL/method/parameters/headers/auth/access → save → Test → enable action and agent kill switch (ActionsForm.jsx:376-503; HttpToolDialog.jsx:136-446).

| Area | Evidence | Status |
|---|---|---|
| Body tab | HttpToolDialog.jsx:378-392 edits testArgsText; ActionsForm.jsx:376-402 sends no body; schema has no body column | VERIFIED IN CODE; HIGH |
| Input schema | simple map or limited JSON Schema (tool-definitions.js:18-65) | PARTIALLY IMPLEMENTED |
| Output schema | executor supports it, but primary owner form does not expose a matching clear workflow | PARTIALLY IMPLEMENTED |
| Credentials | separate encrypted/revocable manager and redaction | VERIFIED IN CODE |
| Publishing | live save plus integer version only | PARTIALLY IMPLEMENTED; MEDIUM/HIGH |
| Test result | owner browser receives bounded bodyText (action.service.js:323-335) | VERIFIED IN CODE; MEDIUM |
| Local demo | localhost fixture path exists (http-executor.js:111-204, 365-379) | VERIFIED IN CODE; local-only |

## 6. Actual data model/contracts

AgentAction (prisma/schema.prisma:293-327) has method GET/POST, URL, frozenHost, headers, input/output schemas, enabled, timeout, credentialId, risk, confirmation, identity/access, idempotent, and integer version. It has no body, response projection, publish state, immutable revision, environment/connection, or circuit-breaker state.

ActionCredential (schema:329-347) is workspace-scoped with type/header, ciphertext/key version, revoke/rotation timestamps. ActionConfirmation (395-424) binds conversation, action or MCP tool, args hash, status, expiry, and evidence. WriteIdempotencyRecord (426-449) stores IN_FLIGHT/OK/ERROR leases and bounded replay. ToolRun (451-475) stores metadata, not bodies. Live tool data remains separate from knowledge (docs/shipped/F11_AGENT_ACTIONS.md:58-67).

## 7. Identity/auth/security findings

Present controls: authenticated owner CRUD; workspace credential check; HS256 identity or host-session subject; expiry/subject checks; cross-user resource binding; END_USER_TOKEN no owner-key fallback; atomic confirmation with capability re-check; HTTPS/local-only URL validation; DNS A/AAAA private-address rejection; manual redirects. Evidence: action-config.js:42-58; identity.js:64-215; authz-binding.js:65-130; policy.js:81-127; confirmation.service.js:205-380; ssrf.js:67-156; http-executor.js:442-451.

### H-01 Public auxiliary routes lack the same conversation capability check

Status: VERIFIED IN CODE. Severity HIGH; exploitability is UNKNOWN / BLOCKED without production/customer data.

Public conversation GET (app/api/public/agents/[publicKey]/conversations/[conversationId]/route.js:14-65) checks public agent and agentId, then returns non-internal messages; it does not read the x-aide-conversation-access-token or verify subject/origin. Public confirmation route (same path confirmations/[confirmationId]/route.js:34-71) similarly checks agent ownership but not conversation capability. Public handoff and feedback routes accept identifiers without the same check (handoff route:34-67; feedback route:13-37). Chat continuation is stricter at chat.service.js:376-405. This inconsistency requires a threat-model and negative tests.

### H-02 Action administration is owner-only

Status: VERIFIED IN CODE. Severity MEDIUM/HIGH depending on product requirement. canManageAgentActions only compares agent.userId to current user (action-config.js:42-49); no workspace-role permission path was found.

### H-03 Owner test body can contain downstream sensitive data

Status: VERIFIED IN CODE. Severity MEDIUM. action.service.js:195-335 returns bodyText to the owner UI; ToolRun is correctly metadata-only, but no field-level response projection/redaction or warning was found.

### H-04 Header policy is implicit

Status: PARTIALLY IMPLEMENTED. resolveHeaders and applyCredentialToHeaders allow owner-defined headers (http-executor.js:69-81; credential-apply.js:17-67), but no explicit hop-by-hop/proxy header denylist was found.

## 8. Orchestration

The separation is sound and VERIFIED BY EXECUTED TEST. runTurn is the channel boundary (orchestrator/index.js:62-121); source routing filters capabilities (loop.js:172-191); web and mixed routes are explicit (loop.js:188-295); loop limits/deduplication/early stops are in loop.js:330-490; HTTP is only reached through invoke-tool; tool bodies are fenced by untrusted-result.js.

Limitations: argument validation is light type/required validation rather than full JSON Schema (tool-definitions.js:114-158); output validation checks only configured top-level keys (http-executor.js:84-108); process-local controls are not global.

## 9. Reliability and side effects

Present: 8-second default/15-second max timeout (action-config.js:33-37); three-step/25-second loop (21-25); two outbound slots per instance (27-28); 30-second success-only GET cache (get-cache.js:8-18, 60-100); method/risk/idempotency-aware retry (http-executor.js:250-295); durable write replay (write-idempotency.js:84-209); preflight action reload (invoke-tool.js:598-625); manual redirect; response caps (http-executor.js:15-18, 224-230, 442-456).

### R-01 Distributed controls absent

Status: VERIFIED IN CODE and DOCUMENTED ONLY as deferred. Severity HIGH for horizontal scale. get-cache.js:1-4 and outbound-semaphore.js:1-4 state process-local behavior; docs/shipped/F11_AGENT_ACTIONS.md:13 says Redis R6 is deferred. No Redis-backed HTTP-tool coordination was found.

### R-02 No circuit breaker or durable retry queue

Status: NOT FOUND IN INSPECTED SCOPE. Severity MEDIUM. There is one short retry, but no host breaker, backoff policy, durable retry/DLQ, or dependency health state.

### R-03 POST idempotency is incomplete because body support is absent

Status: VERIFIED IN CODE. Severity HIGH for write integrations. Idempotency-Key is added (http-executor.js:421-436), but fetch has no body option (442-451).

## 10. Scenario matrix

| Scenario | Result |
|---|---|
| Valid studio GET | VERIFIED IN CODE; F11-B passed |
| Missing arg | VERIFIED BY EXECUTED TEST; SCHEMA_INVALID path |
| Private/metadata/DNS-pinned URL | VERIFIED BY EXECUTED TEST; F11-B/F11-R3 |
| Credential encryption/redaction | VERIFIED BY EXECUTED TEST; F11-R1 |
| Identity/cross-user policy | VERIFIED BY EXECUTED TEST; F11-R2 and edge suite |
| WRITE confirmation/idempotency | VERIFIED IN CODE; focused contracts passed, DB integration not run |
| GET cache/retry/timeout/response cap | VERIFIED IN CODE/TEST; external provider not called |
| Prompt injection in result | VERIFIED BY EXECUTED TEST; 1,000/1,000 edge cases |
| POST JSON body | CONFIRMED DEFECT |
| Public conversation auxiliary routes | SECURITY REVIEW REQUIRED |
| Horizontal global limits/cache | NOT IMPLEMENTED |

## 11. Tests inventory/results

Executed:

| Command | Result |
|---|---|
| npm run test:f11 | PASS, exit 0 |
| npm run test:f11r | PASS, exit 0 |
| node scripts/test-f11-edge-registry.mjs --all | PASS, 1,000 passed / 0 failed |
| npm run test:orchestrator | PASS, exit 0 |
| npm run test:f11-edge | EXIT 1 because the wrapper requires an explicit chunk/range/all; explicit --all then passed |

All suites emitted MODULE_TYPELESS_PACKAGE_JSON warnings for ESM syntax in .js without a package type declaration. No full production/browser suite was run. Not proven: deployed smoke, real third-party HTTP, live credential rotation, multi-node controls, public-route negative browser tests, POST-body journey, and full test:full-suite. No production calls or paid model calls were made.

## 12. Prioritized findings

### P0

1. Close H-01: require the same origin-bound/customer-bound PublicConversationAccess token for public conversation read, confirmation, handoff, feedback, CSAT, and mutation routes. Test missing/wrong/expired/revoked token, wrong origin/subject/agent/conversation.
2. Resolve POST semantics: add body representation/content type/argument substitution/size cap/schema/redaction/idempotency tests, or remove the misleading Body tab and document query/header-only POST.

### P1

1. Decide and implement distributed coordination for rate limits, GET cache, outbound leases, and Redis/DB outage behavior; add two-node tests.
2. Add immutable action revisions and draft/publish/rollback; store effective revision in ToolRun.
3. Add response projection/content-type/nested schema/type validation and owner test PII/secret redaction.

### P2

Add circuit breaker/health; explicit header denylist; richer optional/nested/array/enum/default/output schema UX; owner metrics without bodies; and resolve/document the ESM warning.

## 13. Preserve

Preserve orchestrator/index.js and loop.js; invoke-tool.js as the single gateway; policy/authz/identity/confirmation boundaries; SSRF plus frozen host/manual redirects; AES-GCM credentials; atomic confirmations; durable write idempotency; untrusted-result fencing; metadata-only ToolRun/safe logs; source-route filtering; and transactionally persisted messages/outbox events with streamed activity.

## 14. Unknowns/evidence gaps

Unknown: deployed migration state; dedicated production action/realtime/auth secrets and rotation; single-node versus replicas; whether public identifiers can leak; downstream response sensitivity; intentional anonymous feedback/handoff policy; whether integrations require POST JSON; and current production/browser smoke status.

## 15. Later competitor-research questions

Do comparable platforms provide tool draft/publish/rollback? How are owner credentials separated from end-user OAuth and consent? What PII projection controls exist? Are quotas/circuit breakers global per integration/workspace/user? How are public transcript reads/mutations bound to visitor sessions? What is the expected POST body/schema/retry/idempotency UX?

## 16. Architecture-review handoff

HTTP tools are genuinely shipped in local code and materially hardened; the executed contract suites passed. Release remains CONDITIONAL. Resolve public-route authorization and POST body semantics first, then choose/test multi-instance coordination before relying on workspace/agent limits at scale. Next gate: additive request-contract decision, public-route threat model and negative tests, topology/Redis decision, body/schema/retry/idempotency/multi-node tests, then build/browser/migration-rehearsal/production-like smoke with non-sensitive fixtures.

