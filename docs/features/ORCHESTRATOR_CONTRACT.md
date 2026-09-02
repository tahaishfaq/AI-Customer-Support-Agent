# Orchestrator contracts (O01)

Frozen shapes for Channel → Orchestrator → Capability. Full plan: [`ORCHESTRATOR_LAYER_PLAN.md`](./ORCHESTRATOR_LAYER_PLAN.md).

**Code:** `lib/capabilities/result.js` · `lib/capabilities/builtins.js` · `lib/orchestrator/` (`runTurn`, stop-rules, map-policy) · `lib/actions/invoke-tool.js`  
**Fixtures:** `scripts/fixtures/orchestrator/`  
**Test:** `npm run test:orchestrator` (O0–O5 + O3.1)

---

## CapabilityResult

```js
{
  status: "ok" | "denied" | "needs_user" | "error" | "escalate",
  code: string,
  forModel: string,
  forClient: { type: "none"|"confirm"|"login"|"handoff"|"data", payload?: object } | null,
  meta: {
    capabilityId: string,
    latencyMs: number,
    httpStatus?: number,
    toolRunId?: string,
  },
}
```

| status | Orchestrator |
|--------|----------------|
| `ok` | Continue loop with `forModel` |
| `denied` | Feed refusal; do not retry same tool |
| `needs_user` | Stop; return `forClient` (confirm/login) |
| `error` | Feed safe error; LLM may clarify |
| `escalate` | Stop; desk/handoff path |

## Policy code → status

| Policy / error code | status | forClient.type |
|---------------------|--------|----------------|
| (success) | `ok` | `data` or `none` |
| `CONFIRMATION_REQUIRED` | `needs_user` | `confirm` |
| `IDENTITY_REQUIRED` | `needs_user` | `login` |
| `END_USER_TOKEN_REQUIRED` | `needs_user` | `login` |
| `CROSS_USER_DENIED` | `denied` | `none` |
| SSRF / rate limit / credential / schema / unknown | `error` | `none` |
| handoff request | `escalate` | `handoff` |

## TurnResult (Orchestrator → Channel)

```js
{
  assistantText: string,
  toolSteps: Array<{ name, status, code, latencyMs }>,
  clientActions: Array, // forClient objects
  degraded: boolean,
  latencyMs: number,
  stopReason: "final" | "needs_user" | "max_steps" | "escalate" | "aborted",
}
```

**Entry:** `import { runTurn } from "@/lib/orchestrator"`  
**Channel:** `chat.service` builds context → `runTurn(ctx)` → persist + confirm UI.  
**Streaming (O3.1):** studio SSE — tool rounds emit `tool`; final answer emits `delta`. Embed stays non-stream.  
**Listing:** `listEnabledActionsForAgent` in `tool-loop.js` → Capability Registry.
