# F11 — Agent actions / tools (recommended next after F00)

**Status:** 🎯 **Next numbered feature** after [`F00_DOD_DEMO_BUFFER.md`](F00_DOD_DEMO_BUFFER.md). Do **not** start until buffer DoD is green (or lead skips buffer).  
**Goal:** Bot can **call allowlisted HTTP APIs** (order status, CRM ping) — Zendesk/Botpress “agent acts” story — **without** a flow canvas.  
**Maps to:** Fusion P3-ACTIONS · Botpress tool loop lite · product “wow” without vectors.  
**Prerequisite:** F08 retrieve + F09 prompts shipped. Actions **add tools**; they do not replace knowledge grounding.

> **Deliverables rule:** When a phase is marked ✅, add **Delivered** (files/behavior) and **Manual test**.

---

## Why add this feature?

| Reason | Detail |
|--------|--------|
| Demo wow | “Where is order 123?” → bot calls your API → real status |
| Competitor parity (idea) | Zendesk/Botpress sell tools; we steal **idea**, not canvas |
| F08/F09 already cover Q&A | Next climb is **do**, not only **say** |
| Lighter than F10 | No vector DB / embed pipeline |

### When **not** to open F11

| Situation | Do instead |
|-----------|------------|
| Demo / DoD incomplete | **F00** buffer |
| Huge KB / paraphrase miss | **F10** |
| Need human takeover | **F12** |
| Want Stripe / WhatsApp | OOS later — see roadmap |

---

## Phase A — Scope & identity

### In

- Per-agent **allowlisted** HTTP actions (CRUD in studio)
- JSON input/output schema validation
- Server-side tool loop: model may call tools → results → final answer
- Max steps (e.g. 3–5); timeouts; audit of tool runs
- Studio “Actions” tab + test with sample payload
- Workspace / agent isolation (action only for that agent)

### Out

| Out | Why |
|-----|-----|
| Flow canvas / visual builder | Botpress clone — Never for MVP |
| Marketplace of third-party tools | Trust + support burden |
| Arbitrary code sandbox (JS eval) | Security |
| User-uploaded scripts | SSRF / RCE risk |
| Unlimited outbound URLs | Must allowlist host |

### Identity guardrails

| Keep | Meaning |
|------|---------|
| Answer-from-knowledge first | Tools only when action needed; still refuse invent |
| Origin-locked embed | Tools run **server-side**; embed cannot invent URLs |
| Workspace isolation | Agent A tools never run for Agent B |
| Inspect-only admin | Admin can see audit; cannot “act as” user tools |
| Secrets | API keys not returned to browser / LLM raw in logs |

### Non-goals (banned in F11)

- Fine-tune / custom LLM training  
- Open-web crawl console  
- Billing / Stripe  
- Multi-team RBAC for who can edit actions (single owner OK)

---

## Phase B — Design & functionality

### Data model (sketch)

```
AgentAction {
  id, agentId
  name              // "get_order_status"
  description       // for the model
  method            // GET | POST
  urlTemplate       // https://api.shop.com/orders/{{orderId}}
  headersJson       // { "Authorization": "Bearer {{secret}}" } — secrets resolved server-side
  inputSchemaJson   // JSON Schema for args
  outputSchemaJson  // optional; validate response shape lightly
  enabled           Boolean
  timeoutMs         Int @default(8000)
  createdAt, updatedAt
}
```

Optional later: `AgentActionSecret` encrypted; or env refs like `env:SHOP_API_KEY`.

### Runtime loop

```
User message
  → F08 retrieve knowledge (unchanged)
  → F09 system prompt + tool definitions (OpenAI tools / function calling)
  → LLM may return tool_calls
  → For each call (≤ maxSteps):
       validate name ∈ agent actions + enabled
       validate args vs inputSchema
       SSRF check URL
       HTTP execute with timeout
       feed tool result to model
  → Final assistant text
  → Persist messages + tool audit rows
```

### API surface (sketch)

| Route | Purpose |
|-------|---------|
| `GET/POST /api/agents/[id]/actions` | List / create |
| `PATCH/DELETE /api/agents/[id]/actions/[actionId]` | Update / delete |
| `POST .../actions/[actionId]/test` | Dry-run with sample args (studio) |
| Chat routes | Unchanged URL; chat.service gains tool loop |

### UI

- Agent studio tab **Actions**
- Form: name, description, method, URL template, headers, JSON schema editor (simple)
- Toggle enabled
- “Test action” → show status + truncated body
- Under Test chat reply: timeline “Called get_order_status → 200”

---

## Phase C — Improvements

- Template library (copy): “GET JSON by id”, “POST webhook”
- Redact secrets in UI (show `••••`)
- CoT-lite timeline of tool steps under studio bubble
- Rate-limit outbound calls per agent / workspace
- Disable all actions with one kill switch on agent

---

## Phase D — Error handling

| Case | Behavior |
|------|----------|
| Unknown tool name | Reject; model gets error string; final apology |
| Schema invalid | Reject before HTTP |
| HTTP timeout / 5xx | One retry optional; then fail closed |
| HTTP 4xx | No retry; feed status to model |
| SSRF (private IP, link-local, metadata) | Block; audit `SSRF_BLOCKED` |
| Max steps hit | Stop loop; ask user to clarify |
| Action disabled | Treat as unknown |
| Prompt builder fail | Same as F09 — 500 / safe path |

Safe logs: action name, status, duration, requestId — **not** full response body with PII by default.

---

## Phase E — Production bottlenecks

- Per-tool timeout (default 8s); global loop deadline (~25s under chat `maxDuration`)
- Cap concurrent outbound per agent (e.g. 2)
- Do not run tools on classify path
- Defer heavy POST tools if needed (sync GET first)

---

## Phase F — Scaling

- Short GET sync in request; long jobs → queue later (out of F11 MVP)
- Workspace daily outbound cap
- Cache idempotent GET by args hash (optional, short TTL)

---

## Phase G — Infrastructure

| Decision | Recommendation |
|----------|----------------|
| Secrets | Prefer env / encrypted column; never send secret values to the LLM |
| Egress | Allowlist hostnames per action URL |
| Provider | Keep one LLM with tools support (current OpenAI path) |
| Audit | Store `ToolRun` rows: agentId, actionId, status, durationMs, requestId |

Migration: `AgentAction` + `ToolRun` tables.

---

## Phase H — Production testing

- [ ] Happy path: GET tool returns status in final answer  
- [ ] SSRF to `169.254.169.254` blocked  
- [ ] Max steps enforced  
- [ ] Disabled action not callable  
- [ ] Workspace isolation: Agent B cannot use Agent A action  
- [ ] Studio test button works without full chat  
- [ ] Embed chat can use tools (same server loop)  
- [ ] Audit / ToolRun visible to owner (and admin inspect)  
- [ ] `npm run test:f11` (to add) green  

### Done when

Demo: “Check order **ORD-100**” → allowlisted API → real status in reply, with tool step visible in studio — **no canvas**.

---

## Implementation order (when coding starts)

1. Prisma models + migration  
2. CRUD API + validation (zod)  
3. SSRF helper + HTTP executor  
4. Wire chat.service tool loop  
5. Studio Actions tab + test  
6. Audit UI + smoke scripts  
7. Phase H checklist  

---

## Simple examples (product)

| User says | Action | Result |
|-----------|--------|--------|
| “Status of order 55?” | `GET /orders/55` | “Shipped yesterday…” |
| “Create ticket for refund” | `POST /tickets` | Ticket id in reply |
| “Delete all users” | No action defined | Refuse / no tool |

---

## Steal (not clone)

Botpress/Zendesk **tool calling** — not their marketplace, canvas, or omnichannel.
