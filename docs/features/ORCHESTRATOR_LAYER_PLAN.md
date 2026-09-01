# O01 — Orchestrator layer (5-layer architecture)

**Status:** ✅ **Done** — O0–O5 + **O3.1** streaming (`npm run test:orchestrator`)  
**Product fit:** Botpress-class agent platform — see [`AUDIT_BOTPRESS_VS_HAPY.md`](../AUDIT_BOTPRESS_VS_HAPY.md)  
**Priority rule:** **Security first.** Policy / confirm / identity stay **outside** the LLM.  
**Execution rule:** One phase → test gate → next. Never rewrite chat + tools in one PR.

| | |
|--|--|
| **Goal** | Make Aide’s runtime match the 5-layer model: Channel → Agent → **Orchestrator** → Capability → Domain |
| **Principle** | Orchestrator is **generic**. Tools expose **capabilities**. Domain services own **business rules**. LLM interprets **conversation**. |
| **Shipped** | `chat.service` → `runTurn` + Capability Registry + `invoke-tool` · streaming O3.1 · **do not reopen** for MCP/billing |
| **Related** | F11 Actions · F13 Tools hub · F14 Confirm · [`ARCHITECTURE_ACTIONS_AND_DESK.md`](./ARCHITECTURE_ACTIONS_AND_DESK.md) · [`MCP_DEEP_PLAN.md`](./MCP_DEEP_PLAN.md) |

---

# Part 0 — One-page summary

## Target architecture

```
1. CHANNEL          embed / studio / (later WhatsApp…)
2. AGENT            persona + knowledge + conversation context (LLM interprets)
3. ORCHESTRATOR     turn loop: plan → select capability → invoke → observe → reply / escalate
4. CAPABILITY       registry of AI-friendly ops (HTTP / MCP / built-in: handoff, search_kb…)
5. DOMAIN           business rules + data (customer APIs today; Aide services for desk/billing)
```

```
                CHANNEL
                   │
                AGENT (prompt + KB + history)
                   │
             ORCHESTRATOR  ←── generic, no shop rules
                   │
          CAPABILITY REGISTRY
                   │
     ┌─────────────┼─────────────┐
     ▼             ▼             ▼
  HTTP tools    MCP tools    Built-ins
     │             │             │
     ▼             ▼             ▼
 Domain APIs   External MCP   Aide services
 (orders…)     (GitHub…)      (desk, KB…)
```

## What we are building

1. An explicit **`lib/orchestrator/`** package with a stable **Turn Contract**.  
2. A **Capability Registry** that normalizes HTTP + MCP + built-ins into one shape.  
3. A **Result envelope** every tool returns — so the Orchestrator never parses ad-hoc JSON.  
4. Thin **Channel adapters** that only translate HTTP/SSE ↔ Turn.  
5. Keep **domain rules** in domain services / external APIs — **not** in Orchestrator if/else trees.

## What we are not building

- Visual flow canvas (Botpress Nodes) — still OOS  
- Putting refund / eligibility rules inside Orchestrator  
- A second LLM “planner” that duplicates OpenAI tool-calling (unless O4 proves need)  
- Rewriting F11 policy / confirm from scratch — **wrap and call**, don’t fork  

## Absolute invariants (non-negotiable)

1. **LLM is never the PEP** — `evaluateActionPolicy` stays deterministic.  
2. **Orchestrator never invents business truth** — only tool results + knowledge.  
3. **Every capability invoke goes through one gateway** — no bypass HTTP from chat.service.  
4. **Result envelope is typed** — `ok | denied | needs_user | error | escalate`.  
5. **Channel does not call tools** — only Orchestrator.  
6. **Secrets never enter LLM messages** — redaction stays.  
7. **Idempotent confirms** — F14 contracts unchanged.  
8. **ADMIN / suspend / maintenance / billing gates** stay above Orchestrator (proxy/layout).

---

# Part 1 — Current system (gap analysis)

| Layer | Today (code) | Problem |
|-------|--------------|---------|
| Channel | `app/api/.../chat`, embed, studio | Mixes persistence + LLM kickoff |
| Agent | `prompt-builder` + knowledge in `chat.service` | OK, but tangled with orchestrate |
| Orchestrator | `chatCompletionWithTools` inside `tool-loop.js` | No named module; no formal Result type |
| Capability | `AgentAction` rows + MCP tools ad-hoc merge | Two shapes; no registry API |
| Domain | External HTTP; Aide `handoff` / `confirmation` services | OK for SaaS; contract to LLM is loose strings |

**Implication:** Behavior is already ~70% right. Fix is **extract + contract**, not greenfield rewrite.

---

# Part 2 — Exact contracts (the scale surface)

These four envelopes are the product. Implement them before moving files around.

## 2.1 `AgentContext` (Channel → Orchestrator)

What the Orchestrator may see for one turn:

```ts
{
  requestId: string,
  agentId: string,
  workspaceId: string,
  conversationId: string,
  channel: "studio" | "embed" | "public_api", // later: whatsapp
  userMessage: string,
  history: Array<{ role: "user"|"assistant"|"tool", content: string, ... }>,
  systemPrompt: string,          // already built (Agent layer)
  knowledgeBlock: string|null,   // already retrieved (Agent layer)
  identity: {
    customerSubject: string|null,
    endUserAccessToken: string|null,
    claims: { email?: string, phone?: string }|null,
  },
  flags: {
    publicAccess: boolean,
    actionsEnabled: boolean,
    streaming: boolean,
  },
  signal: AbortSignal,
}
```

**Rule:** Channel builds `AgentContext`. Orchestrator does **not** load agent config from DB except via Capability Registry helpers.

## 2.2 `CapabilityDescriptor` (Registry)

```ts
{
  id: string,                    // stable internal id
  name: string,                  // OpenAI function name
  kind: "http" | "mcp" | "builtin",
  description: string,           // for LLM
  inputSchema: object,           // JSON Schema
  riskLevel: "READ" | "WRITE" | "DESTRUCTIVE",
  accessClass: "GUEST" | "ACCOUNT" | ...,
  requiresIdentity: boolean,
  requiresConfirmation: boolean,
  identityMode: string,
  // invoke handle — opaque to Orchestrator
  sourceRef: { type: "agent_action"|"mcp_tool"|"builtin", id: string },
}
```

**Rule:** Orchestrator only knows descriptors + `invokeCapability(desc, args, ctx)`. It does not know URL templates or MCP transport.

## 2.3 `CapabilityResult` (Tool / Domain → Orchestrator)

**This is the most important type.**

```ts
{
  status: "ok" | "denied" | "needs_user" | "error" | "escalate",
  code: string,                  // e.g. CONFIRMATION_REQUIRED, ORDER_NOT_FOUND
  // For LLM (safe, truncated, redacted)
  forModel: string,
  // For UI / channel (structured, optional)
  forClient: {
    type: "none" | "confirm" | "login" | "handoff" | "data",
    payload?: object,
  } | null,
  // Audit
  meta: {
    capabilityId: string,
    latencyMs: number,
    httpStatus?: number,
    toolRunId?: string,
  },
}
```

| `status` | Orchestrator must |
|----------|-------------------|
| `ok` | Feed `forModel` into tool message; continue loop |
| `denied` | Feed refusal text; **do not retry same tool** this turn |
| `needs_user` | Stop tool loop; return `forClient` (confirm / login) to Channel |
| `error` | Feed safe error; allow LLM to clarify or try alternate tool |
| `escalate` | Stop; Channel/Desk path (handoff) |

**Rule:** Domain / HTTP executor / MCP adapter **must** map all outcomes into this envelope. Raw fetch JSON never reaches the LLM unchecked.

## 2.4 `TurnResult` (Orchestrator → Channel)

```ts
{
  assistantText: string,
  toolSteps: Array<{ name, status, code, latencyMs }>, // audit-safe
  clientActions: Array<forClient>,  // confirm cards, etc.
  degraded: boolean,
  latencyMs: number,
  stopReason: "final" | "needs_user" | "max_steps" | "escalate" | "aborted",
}
```

Channel: persist messages, emit SSE, render confirm UI — **no tool execution**.

---

# Part 3 — Module map (target)

```
lib/agent/
  context.js              # buildAgentContext from chat inputs (extract from chat.service)
  prompt.js               # thin re-export / wrap prompt-builder

lib/orchestrator/
  index.js                # runTurn(ctx) → TurnResult
  loop.js                 # while tools: LLM turn → invoke → observe
  stop-rules.js           # max steps, deadline, needs_user, escalate
  map-policy.js           # policy codes → CapabilityResult

lib/capabilities/
  registry.js             # listCapabilitiesForAgent(agentId)
  invoke.js               # invokeCapability(desc, args, ctx) → CapabilityResult
  adapters/
    http.adapter.js       # wraps http-executor + credentials
    mcp.adapter.js        # wraps mcp.service execute
    builtin.adapter.js    # handoff_request, search_knowledge (optional phases)

lib/domain/               # Aide-owned only (not customer shops)
  desk/                   # optional wrap of handoff.service
  knowledge/              # optional retrieve as capability

# Keep existing (called by adapters, not deleted):
lib/actions/policy.js
lib/actions/http-executor.js
lib/actions/tool-loop.js  # shrink → re-export runTurn until deleted in O3
lib/services/chat.service.js  # Channel + persistence only
```

---

# Part 4 — Orchestrator behavior (generic)

```
runTurn(ctx):
  1. capabilities = registry.list(ctx.agentId) if flags.actionsEnabled else []
  2. messages = history + user (Agent already built system)
  3. loop:
       llm = chatCompletionTurn(system, messages, tools=capabilities)
       if no tool_calls → return TurnResult(final text)
       for each tool_call (GET-first order):
         result = invokeCapability(...)
         append tool message (result.forModel)
         if result.status == needs_user → return TurnResult(stopReason=needs_user, clientActions)
         if result.status == escalate → return TurnResult(stopReason=escalate)
         if denied → continue (do not re-call same with same args)
  4. if max_steps/deadline → final text turn without tools
```

**Forbidden inside Orchestrator:**

- `if (order.status === "shipped")`  
- Hardcoded shop URLs  
- Parsing order IDs with business regex beyond shared validation  
- Choosing HTTP method / credentials  

Those belong in Domain / Capability config.

---

# Part 5 — Phased delivery (full implementation)

## Phase O0 — Spec freeze + fixtures (no runtime change)

**Build**

- This doc accepted  
- Add `docs/features/ORCHESTRATOR_CONTRACT.md` short copy of §2 types (or keep single file)  
- JSON fixtures: sample `CapabilityResult` for ok / denied / needs_user / error  
- Map current policy codes → `CapabilityResult.status` table  

**Test gate**

- [ ] Team agrees contract table  
- [ ] Fixture JSON validates against documented shape  

**Exit:** No code move yet; shared language locked.

---

## Phase O1 — `CapabilityResult` adapter (behavior-preserving)

**Build**

- `lib/capabilities/result.js` — helpers `ok()`, `denied()`, `needsUser()`, `error()`, `escalate()`  
- Wrap **end** of `invokeOneTool` in `tool-loop.js` to emit `CapabilityResult`, then stringify `forModel` as today  
- Map: `CONFIRMATION_REQUIRED` → `needs_user` + `forClient.type=confirm`  
- Map: `IDENTITY_REQUIRED` / `END_USER_TOKEN_REQUIRED` → `needs_user` + `login`  
- Map: `CROSS_USER_DENIED` → `denied`  
- Map: HTTP 2xx → `ok`; transport fail → `error`  

**Security focus:** no change to policy decisions — only shape  

**Test gate**

- [ ] All existing `npm run test:f11*` / `test:f14*` green  
- [ ] Confirm card still appears on public WRITE  
- [ ] Unit: policy code → status mapping  

**Exit:** Contract exists at invoke boundary; UI unchanged.

---

## Phase O2 — Capability Registry

**Build**

- `lib/capabilities/registry.js`  
  - Load HTTP actions + MCP tools (move from `listEnabledActionsForAgent`)  
  - Return `CapabilityDescriptor[]`  
- `actionsToOpenAiTools` consumes descriptors only  
- Kill-switch `actionsEnabled` honored in registry  

**Test gate**

- [ ] Studio + embed still list same tool names  
- [ ] MCP + HTTP both appear  
- [ ] `test:f13` green  

**Exit:** One registry API; tool-loop imports registry, not raw Prisma merge.

---

## Phase O3 — Extract `lib/orchestrator` + thin Channel

**Build**

- `runTurn(ctx)` moves loop out of `chatCompletionWithTools`  
- `chat.service.js`:  
  - build context (prompt + knowledge + history)  
  - `const turn = await runTurn(ctx)`  
  - persist assistant + handle `clientActions`  
- Keep `chatCompletionWithTools` as deprecated wrapper calling `runTurn` for one release  

**Test gate**

- [x] `test:orchestrator-o3` green (wiring + stop-rules)
- [x] Streaming path: documented exception (stream = Agent-only text until O3.1) → **O3.1 shipped** (tools + stream)

**Exit:** Named Orchestrator owns the loop.

---

## Phase O3.1 — Streaming + tools

**Build**

- Studio SSE works even when capabilities/tools are present (builtins no longer block stream)
- Tool rounds: non-stream `chatCompletionTurn` + SSE `tool` progress (name/status only)
- Final user text: `chatCompletionStream` deltas (or chunked emit when text already complete)
- Client `sendChatMessageStream` handles `onTool`
- Embed/public remains non-stream

**Test gate**

- [x] `npm run test:orchestrator-o31`
- [x] chat.service does not require empty tool list for stream
- [x] Orchestrator still has no direct HTTP

**Exit:** Studio can stream replies on agents with tools.

---

## Phase O4 — Built-in capabilities (optional but recommended)

**Build**

Register as capabilities (not prompt hacks):

| Name | Kind | Domain |
|------|------|--------|
| `search_knowledge` | builtin | knowledge retrieve (move stuffing call behind tool **or** keep pre-stuff + optional tool) |
| `request_handoff` | builtin | `handoff.service` |
| `get_conversation_meta` | builtin | safe metadata only |

**Decision lock:** **A (safer)** — knowledge stuffing stays Agent-layer; **O4a** ships `request_handoff` + `get_conversation_meta` only. `search_knowledge` waits for F10/RAG.

**Shipped (O4a)**

- `lib/capabilities/builtins.js` + `adapters/builtin.adapter.js`
- Registry always merges builtins (even when `actionsEnabled=false`)
- Invoke routes `_builtin` before HTTP/MCP policy
- `HANDOFF` → `CapabilityResult.status=escalate`; chat skips double `tryTriggerHandoff`
- `[[NEED_HUMAN]]` marker path kept as fallback

**Test gate**

- [x] `npm run test:orchestrator-o4`
- [x] Orchestrator loop has no desk SQL
- [x] Handoff still works via marker **and** tool

---

## Phase O5 — Hardening & docs

**Build**

- [x] Delete deprecated `chatCompletionWithTools` wrapper  
- [x] Architecture diagram in `ARCHITECTURE_ACTIONS_AND_DESK.md` updated  
- [x] `npm run test:orchestrator` (+ O5) in `test:shipped` + CI  
- [x] Observability: log `stopReason`, capability counts (no payloads)  
- [x] OPEN_SEQUENCE entry closed  

**Test gate**

- [x] `npm run test:orchestrator-o5` (wrapper gone, O-T08, fixtures, CI wiring)  
- [x] Contract fixtures validated in O5  
- [x] Security review gates: chat/loop never call `executeHttpAction`; policy PEP on HTTP/MCP  

**Exit:** Architecture claim is true in code, not only in docs.

---

# Part 6 — Mapping policy codes → CapabilityResult

| Existing code | `status` | `forClient.type` |
|---------------|----------|------------------|
| (allow + HTTP ok) | `ok` | `data` or `none` |
| `CONFIRMATION_REQUIRED` | `needs_user` | `confirm` |
| `IDENTITY_REQUIRED` | `needs_user` | `login` |
| `END_USER_TOKEN_REQUIRED` | `needs_user` | `login` |
| `CROSS_USER_DENIED` | `denied` | `none` |
| SSRF / rate limit / credential miss | `error` | `none` |
| Owner/agent requests human | `escalate` | `handoff` |

---

# Part 7 — Test matrix (selected)

| ID | Scenario | Expected |
|----|----------|----------|
| O-T01 | No capabilities | Orchestrator = single LLM text turn |
| O-T02 | READ tool ok | `status=ok`; model sees truncated body |
| O-T03 | Public WRITE | `needs_user` + confirm card; no HTTP until approve |
| O-T04 | Cross-user ask | `denied`; no HTTP |
| O-T05 | Max steps | `stopReason=max_steps`; final text without tools |
| O-T06 | Abort signal | `aborted`; no half-writes |
| O-T07 | MCP + HTTP same agent | Registry lists both; invoke routes correctly |
| O-T08 | chat.service never imports http-executor | Lint / grep gate |

---

# Part 8 — Migration risk & rollback

| Risk | Mitigation |
|------|------------|
| Confirm UI breaks | O1 keeps same `forClient` payload shape as today’s confirm API |
| Stream path diverges | **O3.1:** tool rounds sync; final text streams; public embed stays non-stream |
| Double policy | Adapters call existing `evaluateActionPolicy` only once |
| Large PR | O1 → O2 → O3 separate PRs; wrappers for rollback |

Rollback: keep `tool-loop.js` wrapper until O5; feature flag `ORCHESTRATOR_V1=0` falls back to old function for one release if needed.

---

# Part 9 — Defaults to lock

| Question | Recommendation | Status |
|----------|----------------|--------|
| Separate “planner” LLM | **No** — use OpenAI tool-calling as planner | Locked |
| Handoff as capability | **O4a** | Done |
| Knowledge as tool | **Not in O1–O4a**; revisit with F10 | Pending |
| Feature flag | Not needed — `runTurn` is sole path after O5 | Done |
| Botpress canvas | Still **OOS** | Locked |

---

# Part 10 — Progress checklist

### Decisions

- [x] Approve O0 contract  
- [x] Planner = tool-calling (not second model)  
- [x] Knowledge stays Agent-layer for O1–O3  

### Phases

- [x] O0 Spec + fixtures (`npm run test:orchestrator-o0`)  
- [x] O1 CapabilityResult adapter (`npm run test:orchestrator-o1`)  
- [x] O2 Registry (`npm run test:orchestrator-o2`)  
- [x] O3 Extract orchestrator + thin channel (`npm run test:orchestrator-o3`)  
- [x] O4a Built-ins: `request_handoff` + `get_conversation_meta` (`npm run test:orchestrator-o4`)  
- [x] O5 Harden + delete wrappers (`npm run test:orchestrator-o5`)  
- [x] O3.1 Streaming + tools (`npm run test:orchestrator-o31`)  

### Security sign-off

- [x] Policy still PEP (`evaluateActionPolicy` in invoke-tool)  
- [x] No secret leakage in `forModel` (existing redaction; O5 grep gates)  
- [x] Confirm / identity paths unchanged in behavior (HTTP still gated; builtins skip confirm by design)  

---

# Part 11 — Related docs

| Doc | Role |
|-----|------|
| [`ARCHITECTURE_ACTIONS_AND_DESK.md`](./ARCHITECTURE_ACTIONS_AND_DESK.md) | F11/F12 simple flows — update after O3 |
| [`F11_AGENT_ACTIONS.md`](./F11_AGENT_ACTIONS.md) | Actions product |
| [`F14_END_USER_AUTH_AND_ACTION_CONSENT.md`](./F14_END_USER_AUTH_AND_ACTION_CONSENT.md) | Confirm / identity |
| [`MCP_DEEP_PLAN.md`](./MCP_DEEP_PLAN.md) | MCP **client** UX (pending); invoke via registry — do not reopen O01 |
| [`.agents/skills/mcp-builder/`](../../.agents/skills/mcp-builder/SKILL.md) | Skill for **demo MCP server** quality (DS1), not Orchestrator |
| [`BILLING_SAFEPAY.md`](./BILLING_SAFEPAY.md) | Gate **above** Orchestrator |
| [`OPEN_SEQUENCE.md`](../OPEN_SEQUENCE.md) | O01 ✅; next eng track **M01** after F00 live |

---

*Document owner: engineering. Orchestrator PRs must not weaken F11-U / F14 policy tests.*
