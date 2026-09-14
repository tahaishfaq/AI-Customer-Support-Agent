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
