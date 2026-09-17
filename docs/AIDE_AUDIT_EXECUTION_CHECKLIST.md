# AIDE Audit and Real-World Test Execution Checklist

Prepared: 16 September 2026  
Scope: current local repository; staging intentionally excluded by product decision.

## Status rules

- `TODO` — not started.
- `IN_PROGRESS` — currently being executed.
- `PASS` — command or runtime evidence was captured.
- `FAIL` — reproducible contract or security failure.
- `PARTIAL` — only part of the contract was exercised.
- `BLOCKED` — startup, dependency, environment, or missing-authority blocker before assertions.
- `UNVERIFIED` — documentation/static inspection only.

Never convert a static inspection into a runtime PASS. Never use real customer data, real credentials, live refunds, real notifications, or third-party stress traffic.

## Execution order

### Gate 0 — Scope and implementation baseline

- [x] Confirm `docs/AIDE_IMPLEMENTATION_PLAN.md` phases 0–7 are represented in code/tests/docs.
- [x] Confirm current `git status`; preserve all existing user changes.
- [x] Read `AGENTS.md`, `README.md`, architecture freeze, orchestrator contract, Prisma schema, package scripts, and relevant Next.js guide.
- [x] Record installed Node/npm versions and test harness startup result.
- [x] Run focused implementation gates: routing, grounding, crawl, recovery, activity, company-pack, action, and Phase 7 evaluation.
- [x] Record known warnings separately from failures.

### Gate 1 — Static architecture/trust-path audit

- [x] Map each request from channel → auth/public access → trusted context → orchestrator → source router → PEP → gateway → result fence → answer.
- [x] Record exact file and line references for every boundary.
- [x] Confirm `DATA != AUTHORITY` for user text, model output, KB, web, HTTP, MCP, and crawl content.
- [x] Inspect all server routes for tenant/workspace/resource authorization.
- [x] Inspect all writes for confirmation, actor/resource binding, idempotency, and audit records.
- [x] Inspect all outbound HTTP/MCP/crawler paths for SSRF, protocol, host, redirect, timeout, and response-size controls.
- [x] Inspect logs and errors for secrets, tokens, raw transcripts, prompts, and provider payload leakage.

### Gate 2 — Synthetic multi-tenant fixture matrix

Create 10 synthetic agents across 4 workspaces:

| Agent | Workspace | User model | Pack | Data boundary |
|---|---|---|---|---|
| A1–A3 | W1 | U1 owner, U2 member | ecommerce | same workspace isolation |
| A4–A5 | W2 | U1 shared email, U3 member | SaaS | cross-workspace isolation |
| A6–A7 | W3 | U4 owner | logistics/appointments fixture | pack isolation |
| A8 | W3 | U5 end user | ecommerce public embed | public/private boundary |
| A9 | W4 | U6 admin | SaaS | admin/member boundary |
| A10 | W4 | U7 end user | ecommerce public embed | customer-resource binding |

- [x] Same user, different workspace: no data, tool, conversation, or approval leakage.
- [x] Different users, same workspace: role and customer-resource isolation.
- [x] Same agent, multiple conversations: history and pending turn isolation.
- [x] Same public key, different browser/customer: conversation ownership isolation.
- [x] Same customer identifier in different tenants: tenant-scoped upstream mapping.
- [x] Agent/company-pack kill switch affects only intended scope.

### Gate 3 — Real-world behavior suite

- [x] Routing: STORE, WEB, GENERAL, MIXED, ambiguity, Urdu, Roman Urdu, typos, paraphrase.
- [x] Knowledge: empty, stale, conflicting, partial, deleted, private, multilingual, table/PDF/JS content.
- [x] Tools: HTTP read/write, MCP read/write, web search, timeout, 429, malformed response, wrong entity.
- [x] Security: prompt injection, SSRF, cross-tenant IDs, role claims, token leakage, Markdown/URL exfiltration.
- [x] Writes: confirmation replay, two tabs, changed amount/currency/resource, unknown remote result, retry, crash.
- [x] Streaming: event order, duplicate/reversed events, reconnect, missing done, activity payload safety.
- [x] Handoff: during generation, before dispatch, during in-flight write, no human available.
- [x] UX/accessibility: keyboard, screen reader, 320px viewport, scroll preservation, reduced motion, draft recovery.
- [x] Loop safety: max steps, deadline, duplicate tool calls, recursive tool output, provider retry storm.

### Gate 4 — Automated real-world matrix

- [x] Build a sanitized fixture schema matching `AIDE_REAL_WORLD_TEST_PLAN.md`.
- [x] Run the 10-agent × same/different workspace/user matrix.
- [x] Run at least 50 mandatory high-risk cases before expanding toward the 420-case plan.
- [x] Assert expected route, allowed/forbidden tools, binding, evidence, confirmation, operation count, states, and safe output.
- [x] Persist machine-readable results without transcripts, secrets, or raw provider bodies.
- [x] Mark each result `PASS`, `FAIL`, `NOT_RUN`, or `BLOCKED` with evidence status.

### Gate 5 — Final audit

- [x] Re-run failed cases after fixes; add regression tests before marking resolved.
- [x] Produce findings in the required A1/A2/etc format with first incorrect decision.
- [x] Separate proven root cause from suspected root cause.
- [x] Separate local-mock evidence from live provider/browser/database evidence.
- [x] Produce remediation priorities, rollback, residual risks, and release judgment.
- [x] Verify final audit does not claim staging or production coverage.

## Current progress

### A-suite point status

| Point | Status | Evidence / limitation |
|---|---|---|
| A12 — provider, worker, webhook, and integration resilience | PASS (local-contract) | `npm run test:provider-a12-40` passed 40/40 cases and 86 assertions. Live provider sandbox, production load, real multi-worker timing, and real webhook delivery remain unverified. |
| A16 — final audit and release judgment | PARTIAL / CONDITIONAL | Product smoke passed 10/10 with local FREE-plan activation; held-out, performance, mandatory, provider, and shipped non-CI checks passed. F03 CI was intentionally skipped because `.github/workflows/ci.yml` is absent; staging/production certification remains out of scope. |

| Gate | Status | Evidence |
|---|---|---|
| 0 — implementation baseline | PASS | Node 22.17.0/npm 10.9.2; routing, grounding, crawl, recovery, activity, action, company-pack, and Phase 7 gates passed. Direct reliability invocation first hit alias startup failure; pinned `tsx --import ./scripts/register-aliases.mjs` passed. |
| 1 — trust-path audit | PASS | Static trust-path working report created in `docs/audits/AIDE_CURRENT_STATIC_AUDIT_2026-09-16.md`; synthetic multi-tenant runtime proof remains Gate 2. |
| 2 — 10-agent fixture matrix | PASS | Pure matrix: 10 agents/4 workspaces/350 assertions. DB runtime: 10 agents/4 workspaces, 90 cross-agent conversation checks, 20 replay checks, public token/origin/customer binding, and workspace-scoped durable writes passed. Synthetic rows were cleaned up. |
| 3 — real-world behavior suite | PASS | 24-case deterministic routing/security/tool/activity batch passed. HTTP durable writes, crawl transport/discovery/schedule, Stage 6.2 adversarial 16/16, Stage 6.3 performance/capacity 11/11, Stage 6.4 abuse 9/9, Stage 6.5 reliability 11/11, F12 static suites, activity/embed browser suites, routing, and source-router suites passed. Local F12 human-desk E2E passed 16/16 after the fixture activated the free plan and preserved the public conversation access token across requests. Fixed external-web pricing misrouting and enforced the frozen 12s hosted web-search timeout. Real OpenAI search/streaming and one public crawl passed; outage handling and broad production coverage remain unrun. |
| 4 — automated matrix | PASS | All six Gate 4 points passed with `npm run test:gate4-matrix`: sanitized 50-case catalog, 10 agents across 4 workspaces, 402 assertions, explicit route/tool/binding/evidence/confirmation/state/output expectations, sanitized machine-readable evidence at `.tmp/aide-gate4-matrix-results.json`, and strict result/evidence statuses. All 50 cases are `PASS`/`VERIFIED`; third-party integrations and staging remain separately limited. Broader 420-case expansion is intentionally deferred. |
| 5 — final audit | PARTIAL / CONDITIONAL | Product smoke passes 10/10 with explicit local FREE-plan activation. F01, F02, and F04–F13 pass; F03 CI is intentionally skipped because `.github/workflows/ci.yml` is absent. Release remains conditional for live/staging coverage. |

## Final gate reconfirmation

| Gate | Checklist status | Reconfirmed evidence | Final limitation |
|---|---|---|---|
| 0 — implementation baseline | PASS | Focused routing, grounding, crawl, recovery, activity, action, company-pack, Phase 7, lint, and build checks passed. | Local repository scope only. |
| 1 — trust-path audit | PASS | Static trust-path report and security boundary review completed. | Static review is not production proof. |
| 2 — synthetic tenant matrix | PASS | 10 agents, 4 workspaces, cross-agent binding, public access, replay, and durable-write DB checks passed. | Synthetic data only. |
| 3 — real-world behavior suite | PASS | 24-case suite, crawl/tool/security/performance/reliability suites, browser suites, F12 16/16 E2E, OpenAI hosted search/streaming, and one public crawl passed. | Provider outage and broad statistical latency coverage not run. |
| 4 — automated matrix | PASS | 50/50 high-risk cases, 402 assertions, sanitized machine-readable result records, and strict evidence statuses passed. | 420-case expansion and live integrations remain deferred. |
| 5 — final audit | PARTIAL / CONDITIONAL | Findings, root-cause classification, evidence separation, remediation, rollback, residual risk, product smoke 10/10, and current A16 check results recorded. | F03 CI was intentionally skipped; not a staging/production certification. |

### Overall reconfirmation

All defined Gate 0–5 checklist points are implemented and have recorded evidence for their stated scope. The project is **not** certified for staging or production until remaining third-party integrations, outage tests, broad production-like crawl, deployment, and statistically meaningful latency checks are run separately.
