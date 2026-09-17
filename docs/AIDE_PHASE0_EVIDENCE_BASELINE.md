# AIDE Phase 0 Evidence Baseline

Prepared: 15 September 2026

Status: Phase 0 baseline captured. No production code was changed in this phase.

## Purpose

Phase 0 separates documented architecture, static implementation evidence, automated test evidence, and manual/runtime evidence. Later implementation phases must not mark an item `VERIFIED` from documentation alone.

## Scope and safety

- Existing user changes were preserved.
- No database reset, migration, dependency change, provider call, production write, or customer-data collection was performed.
- Tests used repository fixtures and local logic where possible.
- Live provider, browser, database, and production behavior remain separate verification categories.

## Repository snapshot

Runtime contract from `README.md` and `AGENTS.md`:

- Node.js 22+.
- Next.js 16 App Router and React 19.
- JavaScript/JSX application source.
- npm package manager.
- Prisma 7 with Neon PostgreSQL.
- Auth.js v5.
- `server.js` hosts Next.js and Socket.IO.

Frozen trust path:

```text
AUTH -> TRUSTED CONTEXT -> ORCHESTRATOR -> SOURCE ROUTER
     -> POLICY PEP -> TOOL GATEWAY -> RESULT FENCE -> ANSWER
```

Canonical implementation anchors:

| Boundary | Current path |
|---|---|
| Chat assembly | `lib/services/chat.service.js` |
| Orchestrator entry | `lib/orchestrator/index.js` |
| Tool loop | `lib/orchestrator/loop.js` |
| Source routing | `lib/services/ai/source-policy.js` |
| Knowledge retrieval | `lib/services/ai/knowledge-retrieve.js` |
| Tool gateway | `lib/actions/invoke-tool.js` |
| Policy | `lib/actions/policy.js` |
| HTTP/SSRF | `lib/actions/http-executor.js`, `lib/actions/ssrf.js` |
| Web search | `lib/actions/web-search.js`, provider adapter |
| Activity events | `lib/chat/activity-emitter.js`, `lib/chat/activity-state.js` |
| Streaming transport | `lib/api/chat-stream.js` |
| Studio UI | `components/chat/ChatWorkspace.jsx` |
| Public UI | `components/embed/PublicWebchat.jsx` |
| Activity UI | `components/chat/AgentActivityBubble.jsx` |
| Website crawl | `lib/services/site-crawler.js`, `lib/services/crawl-knowledge.js` |

## Current route contract

| Route | Expected behavior |
|---|---|
| `STORE` | Agent knowledge and authorized store/API tools; no automatic web search |
| `WEB` | Explicit online/current request; web search if enabled |
| `GENERAL` | Conceptual answer; no automatic web search |
| `MIXED` | Store evidence and online evidence remain separate |

The no-empty-store-to-web-fallback rule passed the freeze smoke.

## Automated evidence captured

Commands were run on 15 September 2026 from the repository root.

| Command | Result | Evidence status | Notes |
|---|---|---|---|
| `npm run lint` | PASS with 0 errors and 63 warnings | `VERIFIED` | Warnings are existing/broad; not silently fixed in Phase 0 |
| `npm run test:f08` | PASS | `VERIFIED` | Lexical/fuzzy retrieval contract passes; this does not prove semantic RAG quality |
| `npm run test:public-evidence` | PASS | `VERIFIED` | Bounded public-evidence suppression and safeguards pass |
| `npm run test:crawl-discovery` | PASS | `VERIFIED` | Sitemap, same-origin links, canonical dedupe, robots/query traps pass |
| `npm run test:crawl-transport` | PASS | `VERIFIED` | Public-address, redirect-origin, bounded-body checks pass |
| `npm run test:orchestrator-o31` | PASS | `VERIFIED` | Loop streaming hooks, chat wiring, client SSE, docs pass |
| `npm run test:f11` | PASS | `VERIFIED` | F11 actions A–H pass |
| `npm run test:crawl-schedule` | FAIL | `PARTIALLY VERIFIED` | Output stopped at `recrawl updates existing WEB doc`; root cause not proven |
| `npm run test:orchestrator` | FAIL | `PARTIALLY VERIFIED` | O0–O4 passed; O5 stopped because `.github/workflows/ci.yml` is missing |
| `./node_modules/.bin/tsx --import ./scripts/register-aliases.mjs scripts/stage6-6.6-architecture-freeze.mjs` | FAIL | `PARTIALLY VERIFIED` | 9/10 passed; prior Stage 6 reports missing |

## What is verified

- The frozen route and module structure are present.
- The no-automatic-web-fallback guard is present in the architecture smoke.
- Orchestrator capability result and policy mappings pass focused tests.
- HTTP and MCP capability descriptors pass focused tests.
- Orchestrator streaming hooks and client SSE wiring pass focused tests.
- Lexical/fuzzy knowledge retrieval contracts pass.
- Public-evidence safeguards pass.
- Crawl discovery and transport security contracts pass.
- F11 action security and retry/semaphore contracts pass.
- Repository lint has no errors, but warnings remain.

## What is not verified

- Full live OpenAI tool/search behavior.
- Production database behavior.
- Production webhook or billing behavior.
- Full browser activity correctness across public embed and Studio.
- JavaScript-rendered website crawling.
- Complete crawl scheduling persistence.
- Semantic/vector RAG quality.
- Cross-replica realtime recovery.
- p95 latency under real load.
- Full 420-case real-world suite.

## Phase 0 findings

### P0 — No new security bypass observed in focused checks

Focused security and freeze checks passed. This is not a universal security certification.

Status: `PARTIALLY VERIFIED` because the full suite and live paths were not complete.

### P1 — Aggregate orchestrator suite has a repository CI fixture blocker

`npm run test:orchestrator` passes O0–O4, then O5 attempts to read:

```text
.github/workflows/ci.yml
```

The file is absent in the current checkout, so assertions after that point do not execute.

Status: `HARNESS_BLOCKED` for the unexecuted O5 portion.

Safe next action: determine whether the CI workflow is intentionally absent or an unrelated user change. Do not create a fake workflow only to make the test pass.

### P1 — Architecture freeze report history is incomplete

The freeze script reports 9/10 checks passed and fails only `S6.6-PRIOR-PASS` because prior Stage 6 reports are missing.

Status: `PARTIALLY VERIFIED`.

Safe next action: locate the expected reports or record them as unavailable. Do not fabricate prior evidence.

### P1 — Crawl schedule test fails

`npm run test:crawl-schedule` exits with failure at:

```text
recrawl updates existing WEB doc
```

The root cause is not yet proven. This must be investigated before Phase 4 changes are called complete.

Status: `FAIL` execution, `UNVERIFIED` root cause.

### P2 — Lint warnings remain

Lint exits successfully with 0 errors and 63 warnings, including React state-in-effect warnings and missing dependencies in existing UI code. These are not Phase 0 blockers unless a changed path depends on them.

Status: `VERIFIED` lint command, `UNVERIFIED` whether each warning is harmful.

## Reported product issues requiring manual/runtime evidence

| Issue | Current evidence | Phase 0 status |
|---|---|---|
| Wrong public tool for plans/signup/maintenance | Static route and public-evidence guards exist; full user-facing reproduction not run in this phase | `UNVERIFIED` |
| Crawl misses website content | Discovery/transport pass; JS rendering and full recrawl not proven | `PARTIALLY VERIFIED` |
| Activity misses running state or labels confirmation as failure | Focused event wiring passes; full browser state sequence not captured | `PARTIALLY VERIFIED` |
| Store/web/general source confusion | Route contract and no-fallback smoke pass; full live answers not proven | `PARTIALLY VERIFIED` |
| Slow responses | No p95 runtime baseline captured | `UNVERIFIED` |
| Duplicate/false action recovery | Focused F11 contracts pass; live upstream ambiguity not proven | `PARTIALLY VERIFIED` |

## Phase 0 gate

Phase 0 is complete as a documentation/evidence baseline, but not as a production readiness gate. Before Phase 1, preserve this report and resolve or explicitly accept:

1. Missing prior Stage 6 reports.
2. Missing `.github/workflows/ci.yml` test harness dependency.
3. Crawl schedule failure.
4. Manual browser verification of the reported activity and wrong-tool issues.
5. A measured latency baseline.

## 2026-09-15 verification update

### Knowledge detail visibility bug fixed

The shared message renderer previously displayed `Used knowledge` in the public embed whenever the API returned `usedKnowledge`. The renderer now requires an explicit `showKnowledgeDetails` flag. Studio and authenticated workspace chat enable it; the public embed disables it.

The authenticated workspace result mapping also now preserves `result.usedKnowledge`, which was missing from that path.

Verified with:

```text
npm run test:chat-activity-browser
```

Result: PASS for embed/light, embed/dark, workspace/light, workspace/dark, studio/light, and studio/dark. The fixture asserts that knowledge details are absent in embed and present in workspace/Studio.

Focused ESLint completed with 0 errors. Five existing warnings remain in the inspected chat/embed/Studio files.

### Remaining blockers before the next phase

- `npm run test:crawl-schedule` initially failed because the smoke test expected the old direct-update location. The assertion now checks the canonical `syncCrawlKnowledge` boundary, and the test passes.
- `npm run test:confirmation-ui-browser` is blocked during onboarding because the local request receives `MissingCSRF`; confirmation UI assertions do not execute.
- The opt-in live provider/browser acceptance run timed out while sending the product/knowledge case. It is not valid live-provider evidence.

The public embed still receives `usedKnowledge` in the server response for the current chat contract, but it does not render the field. Removing that field from public payloads is a separate API-hardening decision.
