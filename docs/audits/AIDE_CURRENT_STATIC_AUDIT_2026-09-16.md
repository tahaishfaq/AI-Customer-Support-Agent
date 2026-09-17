# AIDE Current Static Audit — 16 September 2026

Status: Gate 1 static audit working report. This is not the final audit; the real-world matrix and final re-audit remain pending.

## Evidence boundary

This report uses source inspection, existing deterministic harnesses, and captured local command output. It does not prove production behavior, live provider behavior, browser accessibility, or third-party connector behavior. Staging was intentionally excluded.

## Baseline result

| Area | Execution | Evidence |
|---|---|---|
| Node/npm | PASS | Node 22.17.0, npm 10.9.2 |
| Source routing | PASS | Stage 4.4: 10/10; Stage 5.5: 18/18 |
| Grounding/public evidence | PASS | Phase 3 grounding and public-evidence tests |
| Crawl discovery/schedule | PASS | Crawl discovery and schedule smoke |
| Durable reliability | PASS | Stage 6.5: 11 PASS, 0 FAIL, 2 INFO |
| Activity state/emission | PASS | 10/10 unit tests; browser matrix 6/6 |
| Actions/company packs | PASS | F11-U and F11-R5 smoke |
| Phase 7 local gate | PASS | 9 sanitized cases; no security/replay blockers |

## Trust-path map

```text
Studio/public route
  → auth or public-key/origin access
  → chat service trusted context
  → orchestrator entry
  → deterministic source router
  → filtered descriptors/capabilities
  → policy/tool gateway
  → fenced result/evidence
  → answer and durable activity/persistence
```

### Verified source references

| Boundary | Current source evidence | Static result |
|---|---|---|
| Authenticated chat entry | `app/api/agents/[id]/chat/route.js:25-36` calls `requireAuth` and applies rate limit keyed by user, agent, and IP | VERIFIED in source |
| Public chat entry | `app/api/public/agents/[publicKey]/chat/route.js:23-45` resolves public agent with request origin and rate-limits before body processing | VERIFIED in source |
| Stream input validation | Studio route `:39-61` and public route `:47-73` parse JSON and apply `chatMessageSchema` before dispatch | VERIFIED in source |
| Orchestrator boundary | `lib/orchestrator/index.js:63-103` requires agent/system context, passes workspace/conversation/customer identity, and keeps action kill switch server-owned | VERIFIED in source |
| Source routing | `lib/orchestrator/loop.js:177-207` routes from the last user message and filters actions/descriptors before OpenAI tool construction | VERIFIED in source |
| Web-search PEP | `lib/services/ai/source-policy.js:125-147,195-205` blocks web on non-WEB/MIXED routes and strips writes on GENERAL/WEB | VERIFIED in source/tests |
| Tool agent binding | `lib/actions/invoke-tool.js:143-160` rejects unknown, disabled, or wrong-agent actions | VERIFIED in source |
| Conversation binding | `lib/actions/invoke-tool.js:189-205` checks conversation agent against invoked agent/action | VERIFIED in source |
| Untrusted result fence | `lib/actions/untrusted-result.js:72-115` truncates, labels, detects and neutralizes instruction-like content | VERIFIED in source/tests |
| Knowledge budget | `lib/services/ai/knowledge-retrieve.js:8-40` defines bounded chunk/document budgets | VERIFIED in source |
| Durable turn recovery | `lib/services/turn-run.service.js:35-67` lists stale active runs and marks them recoverable | VERIFIED in source/reliability evidence |
| Durable write recovery | `lib/services/durable-write.service.js:41-99` uses leases, state transitions, unknown outcome, and explicit reconciliation | VERIFIED in source/reliability evidence |
| Activity contract | `lib/chat/activity-emitter.js:5-45` and `lib/chat/activity-state.js:16-70` define safe, deduplicated, bounded state handling | VERIFIED in source/tests |

## Static security conclusions

1. No evidence was found in this pass that model prose is used as tenant, identity, or confirmation authority.
2. Source routing is duplicated defensively at the orchestrator/tool boundary, reducing wrong-tool exposure.
3. Public chat accepts identity-related headers/tokens, but they are passed into the service boundary; the real-world matrix must prove cross-customer and cross-tenant denial with synthetic fixtures.
4. Durable write code deliberately represents ambiguous remote outcomes as `OUTCOME_UNKNOWN`; live connector reconciliation remains connector-specific and is not proven by local static checks.
5. The direct Stage 6.5 invocation initially failed on the repository alias (`@/lib`) before assertions. The prescribed pinned `tsx --import ./scripts/register-aliases.mjs` invocation passed; this is a harness invocation rule, not a product failure.

## Open audit questions for Gate 2

- Can 10 agents across four synthetic workspaces ever observe another agent's knowledge, conversation, approval, tool, or crawl record?
- Does public conversation access remain bound after browser/account/customer switching?
- Do HTTP and MCP result bindings reject explicit wrong-customer identifiers in every private-read path?
- Do handoff ownership epochs stop both new AI output and new dispatch while an external write is in flight?
- Do crawl deletion, stale cache, citation, and export paths revoke private evidence consistently?
- Do retry and reconnect paths preserve one logical operation under concurrent tabs?

These questions are intentionally deferred to the real-world fixture matrix rather than marked PASS from static inspection.
