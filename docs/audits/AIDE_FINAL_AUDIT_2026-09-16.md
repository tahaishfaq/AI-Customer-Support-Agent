# AIDE Final Audit — Gate 5 Initial Findings

Prepared: 16 September 2026  
Scope: local repository, synthetic fixtures, local database, local browser/runtime checks. Staging and live providers were intentionally excluded.

## Executive status

The Gate 3 regressions were rerun after fixes and passed. Gate 4's 50-case automated matrix also passed. The findings below separate proven defects that were fixed from coverage limits that remain unverified.

## A16 current verification refresh

| Command | Current result | Classification |
|---|---|---|
| `TEST_BASE_URL=http://127.0.0.1:3000 npm run test:product` | PASS | 10/10 product smoke checks passed after the fixture activated the local FREE plan; the stale dev process was restarted before rerun. |
| `npm run test:shipped` | `PARTIAL / INTENTIONALLY SKIPPED F03` | F01, F02, and F04–F13 passed; F03 CI was skipped by request because `.github/workflows/ci.yml` is absent. |
| `npm run test:heldout-a14` | PASS | 12 held-out cases × 5 repetitions; route/grounding/citation metrics stable. |
| `npm run test:perf-a15` | PASS | 11 PASS, 3 INFO, 0 FAIL; local DB p95 954.17ms in this refresh. |
| `npm run test:mandatory-a13-72` | PASS | 72/72 cases, 144 assertions. |
| `npm run test:provider-a12-40` | PASS | 40/40 cases, 86 assertions. |
| `npm run lint` | PASS with warnings | 0 errors, 63 existing warnings. |
| `git diff --check` | PASS | No whitespace errors. |

## Complete A-suite rerun

The requested A1–A16 local suite was rerun. A1–A2 Gate 4, A3 tenant, A4–A15
focused gates, A10 browser/activity checks, and the local product smoke passed.
The F03 CI-dependent check was intentionally skipped as requested because
`.github/workflows/ci.yml` is absent. The remaining non-CI shipped checks
passed except F13-T2, which initially failed its existing static contract
because the `HttpToolDialog.jsx` `Inputs` section and separate `Add input`
control were missing. The dialog now has separate URL `Add parameter` and
schema `Add input` controls; F13-T0–T4 were rerun and passed. This finding is
resolved and regression-tested; it was separate from the CI skip.

The product smoke initially stopped at the billing entitlement boundary because
the newly registered test user had no subscription. The local smoke fixture now
activates the seeded FREE plan before creating the agent. The first rerun also
required restarting a stale Next dev process after Prisma regeneration; the
fresh rerun passed all product assertions. F03 remains intentionally skipped.

## Regression evidence

| Command | Result | Evidence |
|---|---|---|
| `npm run test:real-world-gate3` | PASS | 24/24 local contract cases |
| `npm run test:gate4-matrix` | PASS | 50/50 cases, 402 assertions, 10 agents/4 workspaces |
| `TEST_BASE_URL=http://127.0.0.1:3000 TEST_EMBED_ORIGIN=http://127.0.0.1:3000 npm run test:f12:e2e` | PASS | 16/16 local human-desk E2E checks |
| `node scripts/stage4-4.4-routing-validation.mjs` | PASS | 10/10 routing checks |
| `node scripts/stage5-5.5-source-router.mjs` | PASS | 18/18 source-router checks |

## A1 — External pricing question could select the wrong source route

Priority: P1  
Category: correctness / routing / grounding  
Exact reproduction: `Search online for current Shopify pricing`  
Expected: `WEB`, with online evidence and retrieval metadata.  
Actual before fix: the generic pricing signal could classify the request as a store-related route.  
First incorrect decision: source classification treated the generic `pricing` term as a business/store signal before applying the named external-platform web rule.  
Root cause: proven. Overlapping source-intent signals in `lib/services/ai/source-policy.js` caused the wrong route decision.  
Evidence: `lib/services/ai/source-policy.js:74-91`, `lib/services/ai/source-policy.js:116-150`; `scripts/test-real-world-gate3.mjs:18-19`; Stage 4.4 and Stage 5.5 regression outputs.  
Security impact: a wrong route could expose irrelevant capabilities or present external facts as company facts.  
Customer impact: current pricing answers could be incomplete, incorrectly grounded, or mislabeled.  
Latency impact: possible unnecessary knowledge/tool work before web retrieval.  
Smallest safe fix: retain explicit web intent and external-platform subject detection, then apply source-route capability filtering.  
Regression test: `R02-explicit-web`, `R03-mixed-comparison`, `S4.4-WEB`, and `S5.5-MATRIX-WEB`.  
Rollback: revert only the source-policy rule and its regression test if a controlled comparison proves a routing regression; preserve the route-filtering boundary.  
Execution: PASS  
Evidence: VERIFIED for local contract scope.

## A2 — Crawl/retrieval completeness remains a coverage boundary, not a proven current defect

Priority: P2  
Category: retrieval / operations  
Exact reproduction: synthetic partial knowledge, blocked private address, non-HTTPS URL, and untrusted crawl content.  
Expected: partial/unavailable evidence remains visible; unsafe addresses are rejected; crawl content cannot become authority.  
Actual: tested local contracts pass. Partial knowledge remains `PARTIAL`, private/non-HTTPS URLs are blocked, and crawl content is fenced as untrusted data.  
First incorrect decision: none proven in the executed local suite.  
Root cause: unknown for any live JavaScript-rendered, PDF, multilingual, or production-site retrieval gap because those provider/browser crawl conditions were not executed in this gate.  
Evidence: `scripts/test-gate4-automated-matrix.mjs` cases `R45-R50`; `scripts/test-crawl-transport.mjs`; `scripts/test-crawl-discovery.mjs`; `scripts/test-crawl-schedule.mjs`; `lib/services/ai/evidence-bundle.js`.  
Security impact: local SSRF and untrusted-data boundaries are verified; live-site behavior remains outside evidence scope.  
Customer impact: completeness for JavaScript/PDF/locale-heavy sites is not yet proven.  
Latency impact: live crawl/retrieval latency is not measured here.  
Smallest safe fix: keep partial status and provenance visible; run authorized synthetic JS/PDF/locale fixtures before changing retrieval behavior.  
Regression test: Gate 4 `R45-R50` plus crawl transport/discovery/schedule suites.  
Rollback: no production change required; retain the current bounded crawl behavior.  
Execution: PASS for local contracts; NOT RUN for live-site coverage.  
Evidence: PARTIALLY_VERIFIED.

## Root-cause classification

- Proven: external-platform pricing route overlap, fixed and regression-tested.
- Proven: product/F12 local fixtures require explicit free-plan activation after registration; the fixture now activates the local free plan, carries the public conversation access token across requests, and product smoke passes 10/10 while F12 passes 16/16.
- Not proven: live-provider outage behavior, broad/statistically meaningful provider latency, or production-site JavaScript/PDF retrieval failure.

## Evidence boundary

### Verified locally

- Deterministic source routing, capability filtering, grounding states, identity binding, result binding, injection fencing, retry rules, tool replay, activity state transitions, SSRF rejection, and response budgets.
- Synthetic 10-agent/four-workspace tenant matrix.
- Local database durable-write/replay checks.
- Local browser activity/embed layout checks.
- Local F12 human-desk flow using synthetic users and a local server.

### Not verified live

- OpenAI/provider outage behavior against a real provider.
- Broad/statistically meaningful provider p95 generation/search latency; only a three-sample measurement was taken.
- Production or staging deployment behavior.
- Third-party MCP/HTTP integrations with real credentials.
- Production-site JavaScript/PDF crawl completeness.

No local contract result is promoted to live-provider, staging, or production evidence.

## Additional authorized live checks

| Check | Result | Evidence |
|---|---|---|
| `npm run test:full-suite` | PASS | Realtime phases 0–6, realtime browser 4/4, billing B0–B5, and Next build completed successfully. |
| OpenAI hosted web-search probe | PASS | Regular and streaming calls returned search results/citations; streaming emitted `search` and `delta` events. |
| OpenAI latency sample | PASS | Three non-stream samples: p50 2353ms, p95 2447ms; one stream sample: 2326ms. Small sample, not an SLO. |
| Production-like crawl of `https://example.com` | PASS | One discovered/fetched/indexed page, zero failures, zero robots blocks, 892ms. |
| Brandly HTTP integration | BLOCKED | Brandly service at local `:8000` was unavailable; no credentialed or mutating Brandly call was attempted. |

The OpenAI checks are real provider evidence for one configured model/query path. They do not prove outage handling, all models, all regions, or production deployment behavior.

## Remediation priorities

| Priority | Action | Scope | Regression / acceptance |
|---|---|---|---|
| P0 | Keep `DATA != AUTHORITY`, tenant binding, confirmation, idempotency, SSRF, and result-fence boundaries frozen. | Security | Gate 4 identity/injection/write cases remain green. |
| P1 | Preserve deterministic source routing and add new external platforms through tests before adding signals. | Correctness | Route and source-router suites pass; no web fallback for empty store knowledge. |
| P1 | Run authorized provider-sandbox and production-like crawl tests for JS/PDF/locale/stale/deletion behavior. | Retrieval / operations | Record separate live evidence; do not change status to verified from static inspection. |
| P1 | Measure provider p50/p95 by validation, retrieval, tool, web, generation, persistence, and delivery phase. | Latency | Capture region, model/config, concurrency, warm/cold state, and sample size. |
| P2 | Expand the 50-case catalog toward the held-out 420-case plan after live-authority and crawl test access is available. | Evaluation | Preserve machine-readable statuses and avoid counting superficial paraphrases as independent cases. |

## Rollback and residual risk

- Routing rollback: revert the external-platform classification rule and its focused regression test only; keep server-side route filtering and gateway policy in place.
- Test-fixture rollback: revert only the F12 local entitlement/token-fixture changes; no application authorization is weakened by the fixture.
- Timeout rollback: do not remove the 12-second hosted web-search timeout without new latency, abuse, and provider-failure evidence.
- Residual risk: provider outage behavior, Brandly/MCP/other third-party integrations, production deployment topology, and full-site crawl completeness remain unverified.
- Residual risk: this audit does not certify semantic answer quality for every industry, language, or document format.

## Release judgment

Local implementation and security-contract evidence: **PASS**.  
Authorized OpenAI integration, one production-like public crawl, and small-sample latency evidence: **PASS**.  
Staging/production release readiness: **CONDITIONAL / NOT CERTIFIED** because outage, third-party integration, deployment, broad crawl, and statistically meaningful latency evidence remain incomplete.

The safe next release step is an explicitly authorized provider-sandbox or staging run with the same synthetic fixtures and separate evidence labels.

## Gate limitation

This is local evidence only. It does not certify production readiness, live provider behavior, staging behavior, or the full 420-case suite.
