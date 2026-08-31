# Architecture — Agent Actions (F11) & Human Desk (F12)

Simple + production design: flows, who allows what, API keys, no DB calls, human connect, security, fallbacks, edge cases.

**Plans:** [`F11_AGENT_ACTIONS.md`](F11_AGENT_ACTIONS.md) · [`F12_HUMAN_DESK.md`](F12_HUMAN_DESK.md)

---

# Part 0 — Simple summary (pehle yeh parho)

## F11 vs F12 — ek line each

| Feature | Kya hai |
|---------|---------|
| **F11 Actions** | Bot FAQ ke alawa **shop ki live API** call karke jawab deta hai |
| **F12 Human Desk** | Bot ruk jata hai; **owner Inbox** se same chat mein insaan reply karta hai |

## Do alag users (confusion yahan hoti hai)

| Kaun | Kaun hai | Kya karta hai |
|------|----------|---------------|
| **Owner** | Shop / agent banane wala (Aide login) | Actions define, API key set, FAQ add |
| **Customer** | Website widget wala end user | Sirf normal chat — “Order 123 status?” |

Customer ko **“Allow API”** button **nahi** dabana (MVP). Allow **owner ne pehle** action setup karte waqt kar di.

---

# Part 1 — Agent Actions (F11)

## Big question: Live system reply = knowledge base?

**Nahi. Default = NO.**

| Source | Kya hai | Knowledge base mein? |
|--------|---------|----------------------|
| TEXT / PDF / WEB crawl | Permanent FAQ / site pages | **Haan** — `KnowledgeDocument` |
| Tool / API result (order status) | **Us message ke liye** live data | **Nahi** — chat message + audit only |
| Conversation history | Past USER / ASSISTANT lines | Conversation mein; **KB nahi** |

**Kyun?**
- Order status **badalta** rehta hai — FAQ mein save karna galat answers deta hai
- API data **private** ho sakti hai (customer PII) — knowledge mein dump = leak risk
- Tools = **ephemeral context** for this turn; knowledge = **stable company truth**

Optional later (not F11 MVP): “Save this answer as FAQ” button — **explicit** owner action only.

---

## Kaun action define karta hai? API key kaun deta hai?

| Cheez | Kaun deta hai |
|-------|---------------|
| Action name, URL, method | **Owner** (Studio → Actions tab) |
| **API key / Bearer token** | **Owner** — apni **shop ki** key, Aide ki nahi |
| FAQ text | **Owner** |
| Chat message | **Customer** (key kabhi nahi) |

### Owner setup (ek bar)

```
Owner → Agent → Actions → Add

  Name:     get_order_status
  URL:      https://api.myshop.com/orders/{{orderId}}
  Method:   GET
  Header:   Authorization: Bearer {{secret:SHOP_API_KEY}}
  API key:  [ owner paste once ]  → encrypt/env store
  Enable:   ✅

Save → UI par sirf •••••• (full key dubara show nahi)
```

### API key storage — hash ya encrypt?

| Method | Password login | API key (tools) |
|--------|----------------|-----------------|
| **Hash (bcrypt)** | ✅ Theek | ❌ **Nahi** — hash reverse nahi hota, call nahi ho sakti |
| **Encrypt (AES)** | — | ✅ DB column — use time decrypt |
| **Env var** | — | ✅ **MVP recommended** — `SHOP_API_KEY` on Vercel |

**Rules:**
- Key **kabhi** browser / customer / LLM prompt / logs mein nahi
- Sirf **Aide server** HTTP header mein inject karta hai
- Owner key rotate kare to action update ya env change

### MVP secret strategy (implementation)

1. **Phase 1:** `env:SHOP_API_KEY` reference in action header — owner Vercel env set kare  
2. **Phase 2:** Studio encrypted paste field — `AgentActionSecret` encrypted column  

---

## Direct DB call option?

**Nahi — F11 MVP mein sirf HTTP/API.**

| Option | MVP? | Why |
|--------|------|-----|
| HTTP GET/POST (allowlisted URL) | ✅ | Controlled, auditable, SSRF checks |
| Direct SQL / Prisma to shop DB | ❌ | SQL injection, cross-tenant leak, Aide DB ≠ shop orders |
| Direct SQL to Aide Neon for “orders” | ❌ | Shop orders Aide DB mein nahi hote |

**Correct pattern:**
```
❌  Bot → SQL → shop database
✅  Bot → HTTPS API → shop backend → their DB
```

**Internship demo:** mock JSON API (`/api/demo/order/[id]` ya external fake API) — bina real shop DB ke.

---

## “Allow” — teen levels

| Level | Kya | Kaun |
|-------|-----|------|
| **1. Business allow** | Kaun si APIs bot use kar sakta hai | Owner (Actions tab enable) |
| **2. Technical allow** | Sirf allowlisted URL + SSRF block | Aide server (auto) |
| **3. Customer allow** | Popup “Allow API?” | **MVP: nahi** — widget = bot help samjho |

**Optional later (sensitive):** Bot pooch sakta hai *“Order check karun? Order number batao”* — yeh info dena hai, browser permission nahi.

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

**Browser security:** Customer ki machine se shop API **direct nahi** chalti — sirf Aide server call karta hai.

---

## F11 — Happy path flow

```
1. User message (studio Test ya embed widget)
       ↓
2. Server: chat.service
       ↓
3. F08 — knowledge retrieve (FAQ chunks)  ← stable knowledge
       ↓
4. F09 — system prompt + rules + tool definitions (allowed actions)
       ↓
5. LLM decides:
   A) Sirf text jawab (FAQ enough)     → final ASSISTANT message
   B) Tool chahiye                     → tool_call(name, args)
       ↓
6. Server validates:
   - Action exists + enabled + belongs to THIS agent
   - Args match JSON schema
   - URL host allowlisted (SSRF check)
   - Secrets injected server-side (never from browser)
       ↓
7. HTTP call to customer API (timeout e.g. 8s)
       ↓
8. Tool result → wapas LLM (max N steps, e.g. 3)
       ↓
9. Final natural-language answer
       ↓
10. Save: USER message + ASSISTANT message (+ ToolRun audit)
    KnowledgeDocument = UNCHANGED
```

### Same conversation mein mix

User: “Refund policy?” → **only knowledge** (no tool)  
User: “Order 55 status?” → **tool** + short text  
User: “Thanks” → no tool  

Knowledge aur tools **saath** chal sakte hain — tools FAQ replace nahi karte.

---

## F11 — Architecture layers

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Embed /     │────▶│ Chat API     │────▶│ chat.service    │
│ Studio Test │     │ (auth/public)│     │ + tool loop     │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                   │
                    ┌──────────────────────────────┼──────────────┐
                    ▼                              ▼              ▼
            knowledge-retrieve              prompt-builder    tool-executor
            (F08 KB chunks)                 (F09 + tools)     (HTTP + SSRF)
                    │                              │              │
                    └──────────────┬───────────────┴──────┐       │
                                   ▼                      ▼       ▼
                                 LLM (OpenAI)      AgentAction DB   Customer API
                                   │                      │
                                   ▼                      ▼
                            Message (ASSISTANT)    ToolRun audit
```

### Data (sketch)

- `AgentAction` — name, urlTemplate, method, schemas, enabled, timeout  
- `ToolRun` — actionId, conversationId, status, durationMs, requestId (no raw secrets)  
- Messages stay `USER` / `ASSISTANT` — tool internals optional in timeline UI only  

---

## F11 — Security

| Risk | Control |
|------|---------|
| User invents URL | Impossible — only DB allowlisted actions |
| SSRF (hit localhost / cloud metadata) | Block private IPs, link-local, `169.254.169.254` |
| Secret leak to browser / LLM logs | Secrets resolve server-side; logs = name + status + duration |
| Agent A uses Agent B tool | `agentId` check on every run |
| Infinite tool loop | `maxSteps` (3–5) + global deadline |
| Embed client forges tool call | Tools only server-side after LLM; client cannot POST arbitrary tools |

---

## F11 — Fallbacks

| Failure | Behavior |
|---------|----------|
| Tool timeout / 5xx | One soft retry optional → then tell user “couldn’t reach order system” |
| Tool 4xx | Feed error to model → clarify (wrong order id?) |
| Schema invalid | Reject before HTTP |
| No matching tool + no KB | F09 refuse / clarify path |
| OpenAI down | Existing F01 degraded assistant (no tools) |
| Action disabled mid-chat | Treat as unknown tool |

**Fallback rule:** Prefer **honest fail** over inventing order status from imagination.

---

## F11 — Edge cases

| Edge | Handle |
|------|--------|
| User asks FAQ + order in one message | Model may call tool then merge; or ask which first |
| Missing orderId | Clarify before tool |
| Tool returns huge JSON | Truncate before LLM (e.g. 4k chars) |
| Concurrent chats same agent | Rate-limit outbound per agent |
| Owner deletes action during chat | Next step fails closed |
| Public embed + private API | Still server-side; CORS doesn’t expose API key |
| Should this become knowledge? | **No** unless owner explicitly saves FAQ later |

---

# Part 2 — Human Desk (F12)

## Big question: Human kaise connect hota hai?

**Phone / WhatsApp bridge nahi.**  
Same Aide product ke andar:

1. Customer **embed widget** (ya public chat) par baat karta hai  
2. Handoff trigger → conversation status = `WAITING_HUMAN`  
3. **Workspace owner** (jisne agent banaya) Aide app mein **Inbox** kholta hai  
4. Owner **same conversation thread** mein type karta hai (`HUMAN` role)  
5. Customer ko **usi chat bubble** mein human message dikhti hai — seamless UI  

**Kaun human hai (MVP)?**  
Sirf **workspace owner** (ek banda). Multi-agent team = later (Teams OOS).

**Platform admin (`/admin`) human nahi banta** — inspect-only rehta hai.

---

## F12 — Happy path flow

```
┌──────────────┐                      ┌─────────────────────┐
│ Customer     │  same Conversation   │ Workspace owner     │
│ (embed /w/…) │◀──── messages ──────▶│ (/inbox in Aide app)│
└──────┬───────┘                      └──────────▲──────────┘
       │                                         │
       │ 1. Chat with AI (status OPEN)           │
       │ 2. "Talk to human" OR keyword OR AI     │
       │    suggests handoff                     │
       ▼                                         │
  POST /handoff                                  │
  status = WAITING_HUMAN                         │
  aiPaused = true                                │
       │                                         │
       │ 3. Banner: "A human will reply soon"    │
       │ 4. AI replies BLOCKED                   │
       │                                         │
       └──────── inbox shows waiting thread ─────┘
                 │
                 │ 5. Owner opens thread (sees history)
                 │ 6. Owner sends message role=HUMAN
                 │ 7. Embed polls / refreshes → shows human bubble
                 │ 8. Owner Resolve → RESOLVED / optional AI again
```

### Triggers (kaise start)

| Trigger | Who | When |
|---------|-----|------|
| **Button** “Talk to a human” | Customer | Always available (agent setting) |
| **Keyword** (refund dispute, lawyer, speak to manager) | Auto suggest / auto handoff | Agent config |
| **AI decides** “I should escalate” | Model | Only if handoff tool/intent enabled |
| **Owner force** | Studio / inbox | Testing |

### Chat seamless?

**Haan — same thread.**  
Roles in one list:

- `USER` — customer  
- `ASSISTANT` — AI (before handoff)  
- `HUMAN` — owner (after handoff)  

Customer ko lagta hai: pehle bot, phir “Support — Alex” (display name).  
**Alag WhatsApp chat nahi** — same widget.

---

## F12 — Architecture layers

```
Embed chat ──▶ public chat API ──▶ chat.service
                                      │
                         if status WAITING_HUMAN:
                           reject AI completion
                           only accept USER msgs to queue for human
                                      │
Owner Inbox ◀── GET /api/inbox (workspaceId, status)
Owner reply ──▶ POST message role=HUMAN
Resolve     ──▶ status RESOLVED, aiPaused=false (optional)
```

### Data (sketch)

```
Conversation {
  status        OPEN | WAITING_HUMAN | RESOLVED
  handoffReason String?
  handoffAt     DateTime?
  assignedUserId String?   // owner for MVP
  aiPaused      Boolean
}

Message.role: USER | ASSISTANT | HUMAN
```

---

## F12 — Security

| Risk | Control |
|------|---------|
| Other workspace sees inbox | Filter by `workspaceId` of logged-in owner |
| Platform admin replies as human | Forbidden — no human-send API for admin |
| Customer forges HUMAN role | Public API only allows USER; HUMAN requires owner session |
| AI answers while waiting | Server blocks LLM when `aiPaused` / WAITING_HUMAN |
| Spam handoff | Rate-limit handoff per conversation / IP |

---

## F12 — Fallbacks

| Failure | Behavior |
|---------|----------|
| Owner offline | Stay WAITING_HUMAN; optional email notify later |
| Email provider down | Inbox still works; banner only |
| Summary LLM fail | Handoff still succeeds without summary |
| Double handoff | Idempotent — already waiting |
| Resolve then user messages again | Reopen OPEN or new handoff |

---

## F12 — Edge cases

| Edge | Handle |
|------|--------|
| User keeps chatting while waiting | Save as USER; show in inbox; no AI |
| Owner replies then AI also runs | Must not — gate in chat.service |
| Two tabs owner | Last-write wins; audit timestamps |
| Embed closed mid-handoff | Conversation stays waiting; reopen `/w/key` same conversation if history on |
| Handoff without reason | Allowed; reason optional |
| Resolve with “return to AI” off | RESOLVED; new chat may start fresh |
| Angry spam handoff button | Rate limit + cooldown toast |

---

# Part 3 — F11 + F12 together (later)

```
OPEN + tools (F11)
  → handoff → WAITING_HUMAN (tools OFF while human)
  → resolve → OPEN again (tools ON again)
```

While human active: **no tool calls, no AI**.  
Human may tell user to wait; tools resume after resolve.

---

# Part 4 — Production implementation order

### F11 first (recommended)

1. Prisma `AgentAction` + `ToolRun`  
2. SSRF helper + HTTP executor  
3. CRUD Actions tab + secret handling  
4. Wire tool loop in `chat.service` (after F08/F09)  
5. Studio timeline “Called get_order_status”  
6. Smoke: happy path, SSRF block, max steps  
7. Docs + `test:f11`

### F12 second (or alt)

1. Prisma conversation status + `HUMAN` role  
2. Handoff / resolve / human message APIs  
3. Block AI when paused  
4. Inbox UI + embed banner + button  
5. Polling (5–10s) then optional SSE later  
6. Smoke: isolation, no AI while waiting, human visible on embed  
7. Docs + `test:f12`

---

# Part 5 — One-line answers (interview / lead)

| Question | Answer |
|----------|--------|
| Live API reply knowledge banega? | **Nahi** — us turn ke liye context; KB alag rehti hai |
| Kaun action + API key deta hai? | **Owner** (shop); customer nahi |
| API key hash? | **Encrypt/env**, hash-only nahi (call ke liye key chahiye) |
| DB call option? | **Nahi** MVP — sirf HTTP API |
| Customer “allow” karta hai? | **Nahi** MVP — owner pre-allow; optional clarify for order id |
| Human kaise connect? | Same app **Inbox**; owner reply; same conversation thread |
| Chat alag hogi? | **Nahi** — same widget, role HUMAN |
| Security? | Allowlist tools, SSRF block, workspace isolation, AI gate on handoff |
| Fail hone par? | Honest fallback message; no invent; queue for human if offline |

---

# Part 6 — FAQ (common confusion)

**Q: Customer browser se API call hoti hai?**  
A: Nahi. Sirf Aide server.

**Q: Tool result FAQ mein save ho jayega?**  
A: Nahi by default. Optional “Save as FAQ” later.

**Q: Human WhatsApp par jayega?**  
A: Nahi MVP. Same Aide widget thread.

**Q: Admin customer ko reply karega?**  
A: Nahi. Sirf workspace owner Inbox se.

**Q: Demo bina real shop API?**  
A: Haan — mock `/api/demo/order` endpoint.

---

*Design locked for implementation when F00 buffer is done and roadmap opens F11 or F12.*
