# ADR 003 — HTTP Tools Target Architecture

Status: Accepted for phased implementation  
Date: 2026-09-09  
Scope: HTTP tools, public conversation authorization, reusable connections, action revisions, tasks, and execution reliability.

## Context

The repository already implements the following path:

USER/EMBED → AUTH OR PUBLIC ACCESS → TRUSTED CONTEXT → ORCHESTRATOR → SOURCE ROUTER → POLICY → TOOL GATEWAY → HTTP/MCP EXECUTOR → RESULT FENCE → ANSWER.

The current HTTP action model is AgentAction plus workspace-scoped ActionCredential. The existing gateway and security boundaries are valuable and must remain authoritative. The current audit confirmed these gaps before redesign:

- AgentAction supports GET/POST but no request body field; http-executor.js does not pass fetch a body.
- Public conversation retrieval, confirmation, handoff, and feedback do not use the same capability check as public chat continuation.
- GET cache, rate limits, and outbound concurrency are process-local.
- Action version is an integer, not an immutable revision/publish model.
- Owner test responses expose bounded downstream body text.

Evidence: docs/audits/http-tools-current-state-audit.md.

## Decision

Evolve the feature as:

Connection → Action → Task → Existing Orchestrator → Existing Gateway → Execution Records.

The model may propose a capability. Server-side code decides whether it can execute.

### Connection

Introduce workspace-owned integration connections and immutable connection revisions. A connection owns environment, base origin, destination policy, authentication mode, credential reference, header policy, enabled state, and health verification. Existing ActionCredential remains the encrypted secret store. Secrets never enter revision JSON.

### Action

Keep AgentAction as the compatibility-facing stable identity during migration. Add an immutable action-revision contract containing request content type, structured body template, typed input/binding schema, response schema/projection, explicit effect type, connection revision, access/identity/confirmation policy, retry/idempotency policy, author, publication time, and configuration hash.

POST is not automatically WRITE. Side-effect classification is explicit.

### Task

Add bounded, versioned procedures composed of published action revisions. Initial tasks use structured steps and mappings, not an arbitrary visual workflow builder. Independent reads may run in bounded parallelism; dependent steps are sequential; writes require explicit confirmation/reconciliation rules.

### Execution records

Keep approval state separate from execution state:

Approval: PENDING → APPROVED / REJECTED / EXPIRED  
Execution: PREPARED → IN_FLIGHT → SUCCEEDED / FAILED / OUTCOME_UNKNOWN

PostgreSQL remains authoritative for durable execution. Redis is for distributed short-lived coordination where multiple replicas require it.

## Security invariants

1. DATA != AUTHORITY.
2. invoke-tool.js remains the only HTTP/MCP execution gateway.
3. Existing AES-GCM credential encryption and workspace checks remain.
4. Public conversation routes require an origin/customer/conversation-bound capability unless an explicitly anonymous endpoint is separately scoped.
5. Browser customerId, email, order number, or model prose never establishes identity.
6. Private-network destinations remain unsupported by the public executor.
7. Published revisions are immutable.
8. Existing actions migrate additively; no request body or permission is invented during backfill.
9. No generic OAuth is added in this migration; it is a separate design.

## Baseline evidence captured in Phase 0

Runtime: Node 22.17.0, npm 10.9.2, Next 16.3.0, React 19.2.8, Prisma 7.9.1.  
Branch: sami.  
Commit: 3e3042f8b4821d58d3c62ec6078d2fb97e92ee57.  
The worktree was dirty before this phase; unrelated changes were not touched.

Verified file map:

| Boundary | Current location |
|---|---|
| Action CRUD/test | app/api/agents/[id]/actions/**, lib/services/action.service.js |
| Validation | lib/validations/actions.js |
| Credentials | app/api/agents/[id]/credentials/**, lib/services/credential.service.js, lib/actions/secrets.js |
| Gateway | lib/actions/invoke-tool.js |
| Policy/authz | lib/actions/policy.js, authz-binding.js, identity.js |
| Confirmation | lib/services/confirmation.service.js |
| HTTP/SSRF | lib/actions/http-executor.js, ssrf.js, frozen-host.js |
| Orchestrator | lib/orchestrator/index.js, loop.js |
| Result fence | lib/actions/untrusted-result.js |
| Idempotency | lib/actions/write-idempotency.js |
| Audit | ToolRun in prisma/schema.prisma and action.service.js |
| Public access | lib/realtime/public-access.service.js, app/api/public/agents/** |
| Owner UI | components/customization/ActionsForm.jsx, HttpToolDialog.jsx |

Migration inventory:

| Current state | Migration action |
|---|---|
| AgentAction owns URL, headers, schemas, policy, credentialId | Add nullable revision/connection references; dual-read |
| ActionCredential is workspace-scoped and encrypted | Preserve; connection references it |
| PublicConversationAccess stores token hash, subject hash, origin hash, expiry/revocation | Reuse for shared public guard before adding fields |
| ToolRun stores integer actionVersion | Add revision ID/config hash additively |
| WriteIdempotencyRecord is durable | Extend operation/revision fingerprint only after contract review |
| Process-local GET cache/limits/semaphore | Add distributed implementation in later scale phase |

## Phase contracts locked

- Initial request formats: JSON and form-urlencoded.
- Initial execution: synchronous; explicit pending state only for upstream asynchronous acceptance.
- Supported authentication: current API-key-header and bearer credential paths plus verified customer binding.
- Generic OAuth: separate deliverable.
- Public executor: no private-network destinations.
- Response handling: bounded declarative projection before model/UI.
- Production bodies: hidden by default; synthetic or selected/redacted preview only.

## Consequences

Positive:

- Existing security gateway is preserved.
- Owner connections can serve multiple actions.
- Published revisions make approvals and execution history reproducible.
- Typed request/response contracts remove the current POST ambiguity.
- Tasks add business procedures without bypassing the orchestrator.

Trade-offs:

- Additive migrations and temporary dual-read logic are required.
- Full JSON Schema and generic OAuth remain out of the first release.
- Redis becomes an operational dependency for multi-replica global controls.
- Unknown writes require reconciliation or handoff; exactly-once delivery is not claimed.

## Rollback

Each phase is independently reversible. Migrations are additive and nullable first. Execution cutovers are feature-flagged/cohort-based. Legacy AgentAction reads remain until backfill, fixture comparison, and rollback windows complete. Never restore tokenless public transcript/action access as a silent rollback.

## Phase 0 exit decision

Phase 0 is complete when the baseline tests pass, the current path is mapped, sanitized fixtures exist, and no unresolved assumption is treated as an implemented capability. Phase 1 may then begin with the reusable public access guard.

