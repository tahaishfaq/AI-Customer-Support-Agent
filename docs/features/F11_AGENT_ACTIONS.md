# F11 — Agent actions / tools (recommended next after F00)

**Status:** 🎯 **Next numbered feature** after [`F00_DOD_DEMO_BUFFER.md`](F00_DOD_DEMO_BUFFER.md). Do **not** start until buffer DoD is green (or lead skips buffer).  
**Goal:** Bot can **call allowlisted HTTP APIs** (order status, CRM ping) — Zendesk/Botpress “agent acts” story — **without** a flow canvas.  
**Maps to:** Fusion P3-ACTIONS · Botpress tool loop lite · product “wow” without vectors.  
**Prerequisite:** F08 retrieve + F09 prompts shipped. Actions **add tools**; they do not replace knowledge grounding.

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
| **Owner** | Hapy login — agent banata hai, **Actions** tab mein API define + key set |
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
| Hapy DB ≠ shop orders | Shop controls their backend |

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
| **2. Technical allow** | Sirf allowlisted URL + SSRF block | Hapy server (auto) |
| **3. Customer allow** | Popup “Allow API?” | **MVP: nahi** — widget = bot help |

**Baad mein (sensitive):** Bot pooch sakta hai *“Order check karun? Order number batao”* — yeh info dena hai, browser permission nahi.

---

## Customer chat flow (har message)

```
Customer (widget): "Mera order 123 ka status?"

         ↓
    [Hapy server]
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

**Browser security:** Customer ki machine se shop API **direct nahi** chalti. Sirf Hapy server call karta hai (API key wahan). Customer ko key/URL nahi pata.

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
| Secrets | **Phase 1:** env vars (`env:KEY_NAME` in header template). **Phase 2:** encrypted DB column |
| Secret storage | **Never** plain text DB; **never** bcrypt hash (need decrypt for calls) |
| Egress | Allowlist hostnames per action URL |
| Provider | Keep one LLM with tools support (current OpenAI path) |
| Audit | Store `ToolRun` rows: agentId, actionId, status, durationMs, requestId |
| Demo without shop | Mock route `GET /api/demo/orders/[id]` returning fixed JSON |

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
