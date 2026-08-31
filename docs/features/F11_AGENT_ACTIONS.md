# F11 — Agent actions / tools (recommended next after F00)

**Status:** ✅ **Shipped** (Phases A–H) — allowlisted HTTP tools in chat, no flow canvas.  
**Goal:** Bot can **call allowlisted HTTP APIs** (order status, CRM ping) — Zendesk/Botpress “agent acts” story — **without** a flow canvas.  
**Maps to:** Fusion P3-ACTIONS · Botpress tool loop lite · product “wow” without vectors.  
**Prerequisite:** F08 retrieve + F09 prompts shipped. Actions **add tools**; they do not replace knowledge grounding.  
**Verify:** `npm run test:f11`

> **Universal authz (F11-U):** [`F11_UNIVERSAL_AUTHZ_PLAN.md`](F11_UNIVERSAL_AUTHZ_PLAN.md)

> **Shipped redesign (R0–R5):** identity, secrets, DNS-pin SSRF, confirmation — in code. Redis (**R6**) deferred → [`OPEN_SEQUENCE.md`](../OPEN_SEQUENCE.md).  
> **Verify:** `npm run test:f11` · `npm run test:f11r` · `test:f11-ux2`–`ux4`

> **Universal embed authz (planning + partial impl):** [`F11_UNIVERSAL_AUTHZ_PLAN.md`](F11_UNIVERSAL_AUTHZ_PLAN.md) — guest vs logged-in, confirm-before-every-live-call, cross-user refuse, owner config playbook, phases U0–U8.

> **50 businesses catalog:** [`F11_UNIVERSAL_BUSINESSES.md`](F11_UNIVERSAL_BUSINESSES.md) · **5000 business edge cases:** [`F11_BUSINESS_EDGE_CASES.md`](F11_BUSINESS_EDGE_CASES.md)

> **Edge case registry (1000 platform):** [`F11_EDGE_CASE_REGISTRY.md`](F11_EDGE_CASE_REGISTRY.md) — E0001–E1000 · regenerate via `node scripts/generate-f11-edge-cases.mjs`.

> **Full architecture** (flows, KB vs live, security, fallbacks, edge cases): [`ARCHITECTURE_ACTIONS_AND_DESK.md`](ARCHITECTURE_ACTIONS_AND_DESK.md)

> **Deliverables rule:** When a phase is marked ✅, add **Delivered** (files/behavior) and **Manual test**.

---

## Exactly kya hai? (simple)

User poochta hai → bot sirf text nahi, **tumhari allowlisted website/API ko call** kar sakta hai → **real data** la kar jawab deta hai.

**Example:**
- User: *"Order #123 ka status?"*
- Bot: API hit karta hai → *"Shipped, arrives Tuesday"*
- Sirf FAQ se nahi — **live system** se

Studio mein owner **Actions** define karta hai: URL, method, sirf **allowlisted** URLs.

### Kyun karte hain?

| Problem aaj | F11 ke baad |
|-------------|-------------|
| FAQ mein order status nahi ya purani hai | Live API se fresh status |
| User ko "portal par dekho" bolna padta hai | Bot khud check karke batata hai |
| Demo par "sirf chatbot" lagta hai | **"Smart agent jo act karta hai"** |

**Real life:** Zendesk/Botpress bots **tools** use karte hain — hum wahi idea, bina flow canvas ke.

### Kya NAHI hai

- Bot khud se kuch invent nahi karta — sirf owner ki allowed APIs  
- Koi bhi random website scrape nahi  
- Visual flow builder nahi  
- Direct DB / SQL (MVP) — sirf HTTP API  

---

## Quick answers

| Question | Answer |
|----------|--------|
| Live API jawab knowledge base banega? | **Nahi** (default). Sirf is chat turn ke liye. FAQ alag rehti hai. |
| Kaun action + API key deta hai? | **Owner** (Studio). Customer kabhi nahi. |
| Customer “Allow API” dabata hai? | **Nahi** MVP — owner pehle action enable karta hai. |
| API key hash karenge? | **Encrypt ya env** — hash-only nahi (API call ke liye key chahiye). |
| Direct DB call option? | **Nahi** MVP — sirf HTTP allowlisted URL. |
| Flow? | Message → F08 knowledge → LLM tool call → server HTTP → jawab → messages save (KB unchanged) |

---

## Product explain (simple) — 2 users

| User | Role |
|------|------|
| **Owner** | Aide login — agent banata hai, **Actions** tab mein API define + key set |
| **Customer** | Website widget — sirf chat likhta hai, key/API nahi dekhta |

**Customer experience:** Normal chat jaisa. Peeche server shop API call karta hai — customer ko pata bhi nahi chalta.

---

## Owner setup — exactly kya define karega

```
Agent → Actions → Add

  name:          get_order_status
  description:   Look up shipping status for an order (LLM ko samjhane ke liye)
  method:        GET
  urlTemplate:   https://api.myshop.com/orders/{{orderId}}
  headersJson:   { "Authorization": "Bearer {{env:SHOP_API_KEY}}" }
  inputSchema:   { "orderId": "string" }   // LLM se args validate
  enabled:       true
  timeoutMs:     8000
```

Owner **apni shop API key** deta hai:
- **MVP:** Vercel/env `SHOP_API_KEY` set kare; action header mein `env:SHOP_API_KEY`
- **Later:** Studio mein paste → **encrypt** DB → UI par `••••` only

**Kabhi plain text DB mein key mat rakho.**

---

## API key — hash vs encrypt

| Storage | Use for API keys? |
|---------|-------------------|
| bcrypt hash | ❌ Reverse nahi — Bearer header nahi bhej sakte |
| AES encrypt in DB | ✅ Phase 2 |
| Environment variable | ✅ Phase 1 MVP |

Logs / LLM / browser: key **never**.

---

## DB call kyun nahi?

| Direct DB | HTTP API |
|-----------|----------|
| SQL injection risk | Fixed endpoint |
| Cross-workspace leak | Allowlist host |
| Aide DB ≠ shop orders | Shop controls their backend |

Shop ko chhoti API banani hogi (ya demo mock). Bot sirf woh URL hit karega.

**Demo:** `GET /api/demo/orders/[id]` — fixed JSON, no real shop DB.

---

## Customer “allow” — MVP

- Owner action **enable** = business permission  
- Server **SSRF + schema** = technical permission  
- Customer popup **nahi** — optional: bot pooch sakta hai “Order number?”  

### Teen allow levels

| Level | Kya | Kaun |
|-------|-----|------|
| **1. Business allow** | Kaun si APIs bot use kar sakta hai | Owner (Actions tab enable) |
| **2. Technical allow** | Sirf allowlisted URL + SSRF block | Aide server (auto) |
| **3. Customer allow** | Popup “Allow API?” | **MVP: nahi** — widget = bot help |

**Baad mein (sensitive):** Bot pooch sakta hai *“Order check karun? Order number batao”* — yeh info dena hai, browser permission nahi.

---

## Customer chat flow (har message)

```
Customer (widget): "Mera order 123 ka status?"

         ↓
    [Aide server]
         ↓
    FAQ bhi dekhta hai (F08 knowledge)
         ↓
    AI sochta hai: is ke liye live order API chahiye
         ↓
    Server check:
      ✓ Action enabled hai?
      ✓ Is agent ki hai?
      ✓ URL safe hai (SSRF)?
         ↓
    Server API call (customer browser se NAHI — server se)
         ↓
    API: { status: "Shipped" }
         ↓
    AI: "Aapka order 123 shipped hai..."
         ↓
    Customer ko normal message dikhta hai
```

**Customer ne sirf message likha.** Baaki sab peeche server par — jaise aaj chat bhi hoti hai.

**Browser security:** Customer ki machine se shop API **direct nahi** chalti. Sirf Aide server call karta hai (API key wahan). Customer ko key/URL nahi pata.

---

## Customer example (poora scene)

**Shop:** online store · **Owner** ne `get_order_status` action lagayi  

```
Customer Ali (widget):
  Ali: Hi
  Bot: How can I help?

  Ali: Order ORD-999 status?
  [Server: FAQ check → tool needed → API call — Ali ko nahi dikhta]
  Bot: Your order ORD-999 is out for delivery.

  Ali: Refund policy?
  [Server: sirf FAQ — no API]
  Bot: Refunds within 5 business days...
```

Ali ne **kabhi “Allow live system” nahi dabaya.** Owner ne pehle permission de di thi.

---

## Kab customer se kuch chahiye?

| Situation | Bot kya kare |
|-----------|--------------|
| Order number missing | “Please share your order ID” |
| Wrong order id | “I couldn’t find that order” |
| API down | “Order system unavailable — try later or contact support” |
| Sensitive (future) | Explicit confirm: “Should I look up order 123?” |

Yeh **conversation** hai — browser permission popup nahi.

---

## Ab kya hai vs F11 ke baad

| Ab (shipped F08/F09) | F11 ke baad |
|----------------------|-------------|
| User message → FAQ → AI text | + allowlisted HTTP call → live data |
| Sirf **bolna** | **Bolna + karna** (API) |
| Order status FAQ mein purani ho sakti hai | Fresh status API se |

---

## F11 vs F12 (side by side)

| | **F11 Actions** | **F12 Human Desk** |
|---|-----------------|---------------------|
| Bot kya karta hai | API call → data la kar jawab | Ruk jata hai; insaan bolta hai |
| User feel | “Bot ne check kar liya” | “Insaan ne help ki” |
| Best example | Order status, ticket create | Refund dispute, angry user |
| Demo line | “Bot calls your API” | “Human takes over chat” |
| Vectors/RAG? | Nahi chahiye | Nahi chahiye |

**Ek line:** F11 = bot FAQ ke alawa **tumhari API se live kaam** kar sakta hai.

---

## Developer — kya implement karoge

| Layer | Kaam |
|-------|------|
| Owner UI | Actions CRUD (allowlist) |
| Chat API | Tool loop in `chat.service` |
| Tool executor | HTTP + secrets + SSRF block |
| Customer widget | Kam change (same chat box) |
| Audit | `ToolRun` rows |

**Full design** (security, fallbacks, edge cases, diagrams): [`ARCHITECTURE_ACTIONS_AND_DESK.md`](ARCHITECTURE_ACTIONS_AND_DESK.md) Part 1.

| Area | Summary |
|------|---------|
| Security | Allowlist only · SSRF block · secrets server-side · max 3–5 steps · workspace isolation |
| Fallbacks | Timeout → honest fail · 4xx → clarify · OpenAI down → F01 degraded (no tools) |
| Edge cases | FAQ + order same message · huge JSON truncate · action deleted mid-chat |

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

## Phase A — Scope & identity ✅

**Delivered (Aug 2026):**
- Prisma: `AgentAction`, `ToolRun`, `ActionHttpMethod` (GET|POST), `ToolRunStatus`
- Migration: `prisma/migrations/20260824210000_f11_agent_actions/`
- Identity helpers: `lib/actions/action-config.js` (owner-only manage, invoke rules, env secret refs, timeouts, max steps)
- Customization → **Actions** tab shell (`ActionsForm`) — allowlist / env-key rules visible; CRUD in Phase B
- Smoke: `npm run test:f11a`

**Manual test:** `npx prisma migrate deploy` → `npx prisma generate` → `npm run test:f11a`. Open agent → Customization → **Actions** tab.

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
| **Direct DB / SQL queries** | Leak + injection; use HTTP API instead |

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

## Phase B — Design & functionality ✅

**Delivered (Aug 2026):**
- Zod: `lib/validations/actions.js` (create / update / test)
- Service: `lib/services/action.service.js` (list/create/update/delete/test + `ToolRun` audit)
- SSRF: `lib/actions/ssrf.js` · HTTP executor: `lib/actions/http-executor.js` (env secret resolve, demo in-process)
- APIs: `GET/POST /api/agents/[id]/actions`, `PATCH/DELETE .../actions/[actionId]`, `POST .../test`
- Demo shop: `GET /api/demo/orders/[id]` (`ORD-100` → Shipped)
- Customization → **Actions**: add / edit / enable / delete / **Test** with sample args
- Client helper: `lib/api/actions.js`
- Smoke: `npm run test:f11b`

**Manual test:**
1. Customization → Actions → **Add action** (demo URL prefilled)
2. Create → **Test** with `{"orderId":"ORD-100"}` → body shows Shipped
3. Toggle disable → Test should fail “disabled”
4. Try URL `https://169.254.169.254/` via save+test → SSRF blocked

### Chat tool loop ✅ (Aug 2026)

**Delivered:**
- OpenAI tools: `lib/actions/tool-definitions.js` (schema → function tools + arg validate)
- Loop: `lib/actions/tool-loop.js` (`chatCompletionWithTools`, max 3 steps, 25s deadline, `ToolRun` audit)
- LLM turn: `chatCompletionTurn` in `llm.provider.js` (tool_calls)
- `chat.service` loads enabled actions → appends tools prompt → runs loop (studio + embed)
- Studio bubble: **Called:** `get_order_status → 200` timeline
- Smoke: `npm run test:f11c`

**Manual test:**
1. Customization → Actions → add enabled demo `get_order_status` (localhost demo URL)
2. Studio **Test** chat: “What is the status of order ORD-100?”
3. Reply mentions Shipped (or similar); under bubble see **Called: get_order_status → 200**
4. Ask a pure FAQ with no order id → no tool line (knowledge only)

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

## Phase C — Improvements ✅

**Delivered (Aug 2026):**
- Template library in Customization → Actions: GET JSON by id, POST webhook, Demo order status
- Header secret redaction in owner UI (`••••`); save preserves prior env refs
- Outbound rate limit per agent (`RATE_LIMIT_ACTION_OUTBOUND`, default 30/min)
- Agent kill switch: `Agent.actionsEnabled` (migration `20260824220000_f11_actions_kill_switch`)
- Smoke: `npm run test:f11d`

**Manual test:**
1. Actions → pick **GET JSON by id** template → edit URL → Create
2. Edit action with `{{env:SHOP_API_KEY}}` header → reopen → see `••••` (not the env name expanded)
3. Toggle **Allow live tools** off → Studio chat order question should not call tools; Test button disabled / fails
4. Toggle back on → Test ORD-100 still works

---

## Phase D — Error handling ✅

**Delivered (Aug 2026):**
- Retry policy: one automatic retry on timeout / 5xx / network error; **no** retry on 4xx / SSRF / schema
- Model-safe tool results: `lib/actions/tool-errors.js` — short apology guidance; 5xx omits raw body
- Safe logs: `tool.run` with actionName, status, durationMs, requestId (no response body)
- Unknown / disabled / schema / max-steps still fail closed into the model then final reply
- Smoke: `npm run test:f11e`

| Case | Behavior |
|------|----------|
| Unknown tool name | Reject; model gets error string; final apology |
| Schema invalid | Reject before HTTP |
| HTTP timeout / 5xx | One retry; then fail closed |
| HTTP 4xx | No retry; feed status (+ short detail) to model |
| SSRF (private IP, link-local, metadata) | Block; audit `SSRF_BLOCKED` |
| Max steps hit | Stop loop; ask user to clarify |
| Action disabled | Treat as unknown / disabled |
| Prompt builder fail | Same as F09 — 500 / safe path |

Safe logs: action name, status, duration, requestId — **not** full response body with PII by default.

**Manual test:** Point a test action at a URL that 404s → Test shows ERROR, no double-hit delay long. Point at a flaky 503 (or mock) → one retry then fail. Chat with bad order id → bot apologizes without inventing status.

---

## Phase E — Production bottlenecks ✅

**Delivered (Aug 2026):**
- Per-tool timeout default **8s** (clamp ≤15s); tool loop deadline **25s** (already in action-config)
- Concurrent outbound cap: **2 per agent** (`lib/actions/outbound-semaphore.js`) — chat + studio Test
- Classify path: `classifyCompletion` / `classify.js` stay **tool-free** (asserted in smoke)
- Same LLM turn: **GET tools run before POST** (`orderToolCallsGetFirst`)
- Smoke: `npm run test:f11f`

**Manual test:** Two overlapping Studio Tests on the same agent stay responsive; a burst of parallel chats should not open unbounded outbound HTTP. Pure FAQ chat still classifies without tool calls.

---

## Phase F — Scaling ✅

**Delivered (Aug 2026):**
- **GET stays sync** in the chat request; long async / queue jobs remain **out of F11 MVP**
- Workspace daily outbound cap: `RATE_LIMIT_ACTION_DAILY` (default **500** / ~24h per workspace, per instance)
- Idempotent **GET cache** by args hash — TTL `ACTION_GET_CACHE_TTL_MS` (default **30s**); POST never cached; errors never cached
- Cache hits audited as `CACHE_HIT` (no outbound HTTP)
- Smoke: `npm run test:f11g`

**Manual test:** Test the same demo order twice quickly — second Test can show `CACHE_HIT`. After many outbound calls in one workspace, further calls return daily limit guidance.

---

## Phase G — Infrastructure ✅

**Delivered (Aug 2026):** decisions locked in code — not a separate build sprint.

| Decision | Shipped |
|----------|---------|
| Secrets | Env refs `{{env:KEY}}` only (Phase 1). Encrypted DB secrets later. |
| Secret storage | Never plain text in DB; bcrypt banned for API keys |
| Egress | Per-action URL + SSRF block (`lib/actions/ssrf.js`) |
| Provider | OpenAI tools via `chatCompletionTurn` / tool loop |
| Audit | `ToolRun` rows + owner **Recent tool runs** UI |
| Demo without shop | `GET /api/demo/orders/[id]` |

Migration: `AgentAction` + `ToolRun` (+ `Agent.actionsEnabled` kill switch).

---

## Phase H — Production testing ✅

**Delivered (Aug 2026):** checklist covered by smoke `npm run test:f11h` + earlier phase tests.

- [x] Happy path: GET tool → status in final answer (tool loop + demo API)
- [x] SSRF to `169.254.169.254` blocked
- [x] Max steps enforced (`MAX_TOOL_STEPS = 3`)
- [x] Disabled action not callable
- [x] Workspace isolation: Agent B cannot use Agent A action (`canInvokeAgentAction`)
- [x] Studio test button works without full chat
- [x] Embed chat can use tools (same `chat.service` loop)
- [x] Audit / ToolRun visible to owner (Actions → Recent tool runs)
- [x] `npm run test:f11` green

### Done when

Demo: “Check order **ORD-100**” → allowlisted API → real status in reply, with tool step visible in studio — **no canvas**. ✅

---

## Implementation order (when coding starts)

1. Prisma models + migration ✅  
2. CRUD API + validation (zod) ✅  
3. SSRF helper + HTTP executor ✅  
4. Wire chat.service tool loop ✅  
5. Studio Actions tab + test ✅  
6. Audit UI + smoke scripts ✅  
7. Phase H checklist ✅  

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
