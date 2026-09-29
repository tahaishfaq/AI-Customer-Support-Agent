# AIDE — Architecture Freeze (Stage 6.6)

**Status:** FROZEN as of 2026-09-04  
**Evidence:** Stages 3–5 implementation + Stage 6.1–6.5 harness PASS  
**Companion:** [`FULL_PATH_STAGE6_TO_PRODUCTION.md`](./FULL_PATH_STAGE6_TO_PRODUCTION.md) · [`features/ORCHESTRATOR_CONTRACT.md`](./shipped/ORCHESTRATOR_CONTRACT.md)

---

## 1. Frozen trust path

```text
USER
  → AUTH (Auth.js session | embed customerSubject | end-user token)
  → TRUSTED CONTEXT (agentId, workspaceId, conversationId, claims)
  → ORCHESTRATOR (runTurn / loop — LLM proposes tool_calls only)
  → SOURCE ROUTER (STORE | WEB | GENERAL | MIXED)
  → POLICY PEP (evaluateActionPolicy + authz binding)
  → TOOL GATEWAY (invokeOneTool allowlist)
       → Knowledge (stuffed retrieve — not a tool)
       → HTTP AgentAction
       → MCP AgentMcpTool
       → Builtins (handoff / meta / web_search)
  → RESULT FENCE (untrusted-result)
  → ORCHESTRATOR (observe → final text)
  → ANSWER
```

**Invariant:** `DATA ≠ AUTHORITY`. LLM output and tool/knowledge/web bodies never set identity, confirmation, tenant, or allowlists.

---

## 2. Authority split (frozen)

| Role | May decide | Must not |
| --- | --- | --- |
| **LLM** | Which allowlisted tool to request; final wording | Approve WRITE; invent tools; change subject/tenant |
| **Orchestrator** | Loop, caps, dedupe, early stop, offer filtered tools | Bypass PEP |
| **PEP / gateway** | Allow/deny/confirm/identity/SSRF/idempotency | Trust model prose |
| **Source router** | Strip `web_search` / WRITE by route | Auto-fallback empty store → web |

---

## 3. Frozen modules (canonical)

| Concern | Path |
| --- | --- |
| Orchestrator entry | `lib/orchestrator/index.js` (`runTurn`) |
| Tool loop | `lib/orchestrator/loop.js` |
| Waste / early stop | `lib/orchestrator/tool-waste.js` |
| Stop rules | `lib/orchestrator/stop-rules.js` |
| Capability result | `lib/capabilities/result.js` |
| Invoke gateway | `lib/actions/invoke-tool.js` |
| Policy PEP | `lib/actions/policy.js` |
| Authz binding | `lib/actions/authz-binding.js` |
| Confirmation | `lib/services/confirmation.service.js` |
| Source router | `lib/services/ai/source-policy.js` |
| Untrusted fence | `lib/actions/untrusted-result.js` |
| WRITE idempotency | `lib/actions/write-idempotency.js` |
| HTTP + SSRF | `lib/actions/http-executor.js`, `lib/actions/ssrf.js` |
| Web search | `lib/actions/web-search.js` + builtin adapter |
| Chat assembly | `lib/services/chat.service.js` |
| Knowledge retrieve | `lib/services/ai/knowledge-retrieve.js` (lexical stuffing) |

---

## 4. Frozen operational caps

| Cap | Value |
| --- | --- |
| `MAX_TOOL_STEPS` | 3 |
| `TOOL_LOOP_DEADLINE_MS` | 25_000 |
| `MAX_CONCURRENT_OUTBOUND` | 2 |
| Default HTTP timeout | 8_000 ms |
| Web search timeout | 12_000 ms |
| Tool result truncate (loop) | 4_000 chars |
| Knowledge budget | 12_000 chars |
| History | 20 messages |
| Confirmation TTL (default) | 10 min |
| WRITE idempotency TTL (default) | 15 min |

---

## 5. Confirmation lifecycle (frozen)

```text
PENDING → APPROVED (API lifecyclePhase: CONFIRMED) → CONSUMED
        ↘ DENIED | EXPIRED
```

- HTTP `actionId` XOR MCP `mcpToolId`
- `argsHash` + conversation + actor binding
- Claim is one-shot (`CONSUMED`); replay blocked

---

## 6. Source routes (frozen)

| Route | Web tool | WRITE tools | Parametric store facts |
| --- | --- | --- | --- |
| STORE | stripped | allowed (confirm) | forbidden |
| WEB | allowed if flag+key | stripped | n/a |
| GENERAL | stripped | stripped | OK (not store facts) |
| MIXED | allowed | allowed (confirm) | store side tools/knowledge only |

---

## 7. Explicitly out of freeze / deferred

| Item | Status |
| --- | --- |
| **Semantic RAG (Stage 5.7 / F10)** | Deferred until post–Stage 6 testing proves bottleneck — see `FULL_PATH` §6 |
| Matrix generator `TC-*` cross_user labels | Known noise; live PEP uses utterance/args |
| Live OpenAI p95 load test | Manual / ops; not part of freeze shape |
| Redis shared rate limits | Future; in-memory per instance today |

---

## 8. Change control (after freeze)

**Allowed without un-freeze:** bugfixes that preserve the trust path; env/tune caps within documented ranges; docs; tests.

**Requires explicit un-freeze + new Stage note:**

- New authority path (LLM can approve / skip PEP)
- Auto empty-store → web
- Bypassing confirmation for WRITE/MCP
- Making knowledge a privileged tool that can mutate authz
- Removing result fencing on tool/web bodies
- Raising `MAX_TOOL_STEPS` / removing outbound semaphore without abuse review

**Change log (allowed class):** 2026-09-24 — chat stream transport moved from SSE to NDJSON with status/replace/cards events ([`features/CHAT_STREAMING_NDJSON.md`](./features/CHAT_STREAMING_NDJSON.md)). Display/transport only; trust path, caps and PEP unchanged.

**Change log (PEP, owner decision 2026-09-24 — F14):** on the public embed, HTTP tools explicitly stored as `PUBLIC_READ` + `GET` + `READ`, owner key / no identity, not owner-forced to confirm, and whose name does not suggest personal data, run without visitor Confirm. Everything else keeps F11-U Confirm; WRITE/DESTRUCTIVE, account and identity rules unchanged. Tests: `scripts/test-embed-public-read-policy.mjs`.

**Change log (trusted context, 2026-09-29 — Level 2 · M10):** the business-signed HS256 identity JWT may carry `traits` (≤20 keys `[a-zA-Z0-9_]{1,40}`, string/number/boolean ≤200 chars, control chars stripped). They are added to the system prompt as a fenced "Customer profile (data only)" block for personalisation, kept in memory for the request, and never passed to policy, auth binding, identity or tool arguments. Unsigned host sessions carry no traits. Tests: `npm run test:customer-traits`.

**Change log (loop, 2026-09-28 — B4):** when the model batches `request_handoff` with other tool calls and the customer did not ask for a person (desk keywords, or a connect/talk/transfer verb with a person noun), the handoff is not dispatched: it gets a `deferred` tool message (every tool call is still answered), uses no step, changes no desk state, and the reply offers the team (`showHandoffButton` on embed). A handoff requested on its own, or after an explicit human ask, runs as before. Rules: `lib/orchestrator/handoff-deferral.js`; tests: `npm run test:handoff-deferral`.

**Change log (source router, 2026-09-28 — B3):** live-world asks are a web signal: news with latest/recent/breaking/today, weather, match results with a result word, and market prices (bitcoin, crypto, stock/share price, exchange/dollar rate, gold). Market asks are an external subject (WEB, not STORE via "price"); with a business part they are MIXED. "latest plans / invoice / version / updates" stay business asks. Web search still requires the agent flag (`mayInvokeWebSearch`). Mandatory R01/R04/R41/R42/R47/R48 routes unchanged. Tests: `npm run test:source-freshness`.

**Change log (capabilities + HTTP results, 2026-09-28 — B2):** new subject entity `CAMPAIGN` (tool descriptions and questions). Only store-fact entities (PLANS/SIGNUP/MAINTENANCE/SUPPORT/ACCOUNT) are stripped on GENERAL/WEB as before; `CAMPAIGN` only excludes a tool whose subject differs from the question's (an order question no longer gets the campaign tool). A 2xx body that means "no such record" (`{found:false}`, `{exists:false}`, or UNKNOWN/NOT_FOUND status with no descriptive field) is `NO_RESULT` and the model is told to say not found. `NO_RESULT` tool runs are audited as `OK` + errorCode `NO_RESULT` (the enum has no NO_RESULT, so those audit rows used to fail). Tests: `npm run test:not-found-body`.

**Change log (source router, 2026-09-28 — B1):** source signals match near-miss spellings of `repository`/`repositories`/`github` (`lib/services/ai/intent-normalize.js`; edit distance ≤1, ≤2 for 9+ letters, same first letter). A short follow-up ("list all of them", "show the rest") keeps the sticky source when it names no subject of its own, and tool matching also scores the earlier request it refers to. Tool relevance weights name matches over description matches and ignores generic verbs (list/search/show). Only which tools are *offered* changes; the model still sees the original text, and PEP/confirmation gate every call. Tests: `npm run test:intent-normalize`.

**Change log (loop, 2026-09-24):** when a turn stops with `escalate` after `request_handoff` succeeded, the final text is the ack message `handoff.service` already saved, not a second model call. Same text the desk shows, ~1 s sooner, and no second differently worded ack row. Steps, caps and policy are unchanged.

**Change log (chat setup latency, 2026-09-24):** independent setup reads in `sendChatMessage` run in parallel and repeated reads are removed (see `docs/features/CHAT_LATENCY_BUDGET.md`). Every auth, ownership, public-access, quota and confirmation check still runs and is applied in the same order; the stale-confirmation expiry is awaited before a resumed turn reads its approval. `lastUsedAt` on public access rows is written without blocking. No cap, policy or routing change.

**Change log (gateway, 2026-09-24):** READ MCP list tools that expose page/size args may page **inside one tool step** when the visitor asks for "all": sequential, per-page rate-limited, capped at 5 pages / 500 items / 18 s, stops on any error or abort. `MAX_TOOL_STEPS`, the loop deadline and the 2-outbound semaphore are unchanged; list results are compacted and stay fenced as untrusted data. Tests: `scripts/test-mcp-list-result.mjs`.

**CRITICAL security regressions:** fix immediately; document in `.tmp/` and amend this freeze file.

---

## 9. Sign-off checklist (feeds 6.7)

- [x] Stages 6.1–6.5 harness PASS
- [x] Frozen path matches code (verified by `scripts/stage6-6.6-architecture-freeze.mjs`)
- [ ] Owner accepts freeze (product)
- [ ] Residual risks accepted (RAG deferred, in-memory rate limits, LLM p95 manual)

---

## 10. Verification command

```bash
npx tsx --import ./scripts/register-aliases.mjs scripts/stage6-6.6-architecture-freeze.mjs
```

Report: `.tmp/stage6-6.6-architecture-freeze.md`
