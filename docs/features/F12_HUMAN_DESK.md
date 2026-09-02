# F12 — Human desk handoff (alt next after F00)

**Status:** ✅ **Shipped** — Phases A–H complete  
**Goal:** Escalate live chats to a **human inbox inside the customer workspace** (not platform admin). Resume AI optional.  
**Maps to:** P3-DESK · Fin/Zendesk/Botpress handoff lite.  
**Prerequisite:** Conversations + embed + studio already shipped. F08/F09 unchanged for AI turns.

> **Full architecture** (human connect flow, same-thread chat, security, edge cases): `[ARCHITECTURE_ACTIONS_AND_DESK.md](ARCHITECTURE_ACTIONS_AND_DESK.md)`

> **Deliverables rule:** When a phase is marked ✅, add **Delivered** and **Manual test**.

---



## Quick answers


| Question             | Answer                                                                                |
| -------------------- | ------------------------------------------------------------------------------------- |
| Human kaise connect? | Customer handoff → owner **Inbox** (Aide app) → same conversation; not WhatsApp/phone |
| Chat seamless?       | **Haan** — same widget thread; role `HUMAN` messages                                  |
| Kaun human?          | MVP = **workspace owner** only (not platform admin)                                   |
| Customer alag app?   | **Nahi** — same embed bubble, banner “human will reply”                               |
| AI jab human active? | **Band** — sirf owner reply                                                           |


---



## Product explain (simple) — kaun kahan hota hai

```
┌─────────────────────┐         ┌─────────────────────┐
│  CUSTOMER           │         │  OWNER (human)      │
│  Shop website       │         │  Aide app login     │
│  Embed widget /w/…  │         │  /inbox             │
└──────────┬──────────┘         └──────────▲──────────┘
           │                               │
           │    SAME conversation thread     │
           └───────────────────────────────┘
```


| Step | Kya hota hai                                                 |
| ---- | ------------------------------------------------------------ |
| 1    | Customer AI se baat karta hai (status `OPEN`)                |
| 2    | “Talk to human” / keyword / AI escalate                      |
| 3    | Status → `WAITING_HUMAN`, AI **off**                         |
| 4    | Owner phone/laptop par Aide **Inbox** kholta hai             |
| 5    | Poori chat history dikhti hai                                |
| 6    | Owner type karta hai → customer ko **usi widget** mein reply |
| 7    | Owner **Resolve** → optional wapas AI                        |


**Phone call / WhatsApp bridge MVP mein nahi.**

---



## Customer view vs Owner view


| Customer (widget)                  | Owner (Inbox)                  |
| ---------------------------------- | ------------------------------ |
| Bot messages (`ASSISTANT`)         | Full thread + handoff reason   |
| Banner: “Human will reply soon”    | Waiting queue list             |
| Human reply (`HUMAN`) same bubbles | Composer to reply              |
| AI silent while waiting            | Resolve / Return to AI buttons |


**Seamless:** Customer ko lagta hai ek hi chat — pehle bot, phir insaan. Alag channel nahi.

---



## Exactly kya hai? (simple)

Jab AI **stuck** ho ya user **insaan** chahe → chat **human inbox** mein chali jati hai → **workspace owner** reply karta hai → user ko **embed/widget** par wahi reply dikhti hai.

```
User chat → AI jawab nahi / "Talk to human"
    → Status: WAITING_HUMAN
    → Owner ke Inbox mein thread
    → Owner type karta hai (role HUMAN)
    → User ko human message — same widget
    → Resolve → optional wapas AI
```



### Kyun karte hain?


| Problem aaj                                    | F12 ke baad       |
| ---------------------------------------------- | ----------------- |
| Angry customer, refund fight — AI galat risk   | Human le leta hai |
| Legal / sensitive — AI nahi chahiye            | Escalation safe   |
| “Mujhe banda chahiye” — bot ke paas jawab nahi | Real support path |


**Real life:** Intercom/Zendesk **handoff to agent** — hum lite version: **ek owner**, full Zendesk clone nahi.

### Kya NAHI hai

- Phone call / WhatsApp bridge (MVP)  
- Poori call center / shift scheduling  
- Team of 10 agents with roles (pehle sirf **ek owner**)  
- Platform admin customer ko reply karta hai (**inspect-only**)

---



## Handoff triggers (kaise start)


| Trigger                                                | Who                         | When                      |
| ------------------------------------------------------ | --------------------------- | ------------------------- |
| **Button** “Talk to a human”                           | Customer                    | Agent setting se enable   |
| **Keyword** (refund dispute, lawyer, speak to manager) | Auto suggest / auto handoff | Agent config              |
| **AI decides** “I should escalate”                     | Model                       | Sirf agar handoff enabled |
| **Owner force**                                        | Studio / inbox              | Testing                   |


---



## Ab kya hai vs F12 ke baad


| Ab (shipped)                     | F12 ke baad                          |
| -------------------------------- | ------------------------------------ |
| User message → FAQ → AI text     | + escalate → human reply same thread |
| Sirf **bolna**                   | **Bolna + escalate** (human)         |
| Stuck user ke liye koi path nahi | Owner Inbox se takeover              |


---



## F11 vs F12 (side by side)


|                   | **F11 Actions**       | **F12 Human Desk**               |
| ----------------- | --------------------- | -------------------------------- |
| Bot kya karta hai | API call → jawab      | Ruk jata hai; insaan bolta hai   |
| Best example      | Order status          | Refund dispute, angry user       |
| Kaun pehle?       | **Default after F00** | Alt — agar handoff story chahiye |


**Ek line:** F12 = bot **hat jata hai**, **insaan inbox se** customer ko reply karta hai.

**F11 + F12 saath (baad mein):** Human active → tools OFF, AI OFF. Resolve ke baad dono wapas ON.

**Full design** (security, fallbacks, edge cases): `[ARCHITECTURE_ACTIONS_AND_DESK.md](ARCHITECTURE_ACTIONS_AND_DESK.md)` Part 2–3.


| Area       | Summary                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| Security   | Workspace inbox isolation · customer cannot forge HUMAN · AI blocked when waiting · handoff rate-limit   |
| Fallbacks  | Owner offline → queue WAITING_HUMAN · double handoff idempotent · summary LLM fail → handoff still works |
| Edge cases | User keeps chatting while waiting · owner two tabs · embed closed mid-handoff · spam handoff button      |


---



## Why add this feature?


| Reason             | Detail                                                |
| ------------------ | ----------------------------------------------------- |
| Real support teams | AI stuck → human takes over                           |
| Trust              | High-risk topics (billing dispute, legal) need person |
| Competitor story   | Desk handoff without building full Zendesk            |




### When **not** to open F12


| Situation                             | Do instead                   |
| ------------------------------------- | ---------------------------- |
| Need “bot calls API” wow              | **F11**                      |
| Huge KB wrong chunks                  | **F10**                      |
| DoD / demo incomplete                 | **F00**                      |
| Multi-agent staffing / SLA / WhatsApp | OOS later (Teams / Channels) |


---



## Phase A — Scope & identity ✅

**Delivered (Aug 2026):**

- `ConversationStatus` enum: `OPEN` | `WAITING_HUMAN` | `RESOLVED`
- `MessageRole.HUMAN` for owner inbox replies
- Conversation fields: `handoffReason`, `handoffAt`, `assignedUserId`, `aiPaused`
- Migration: `prisma/migrations/20260823210000_f12_conversation_desk/`
- Desk helpers: `lib/desk/conversation-desk.js` (identity guardrails, pause checks)
- API surfaces desk fields on owner + public conversation reads
- `MessageBubble` shows **H** avatar for human messages
- Smoke: `npm run test:f12a`

**Manual test:** Run `npx prisma migrate deploy` then `npm run test:f12a`. Existing conversations default to `OPEN` / `aiPaused=false`.

### In

- Conversation status: `OPEN` | `WAITING_HUMAN` | `RESOLVED` (names exact TBD in Prisma)
- User or model can trigger **handoff**
- Workspace **inbox** for owner: list waiting threads
- Human reply as `HUMAN` (or `ASSISTANT` with flag) — visible on embed + studio
- Context handoff: last N messages + optional AI summary + reason
- Risk filters lite: keywords → suggest handoff
- Cross-workspace isolation



### Out


| Out                                            | Why                                                                     |
| ---------------------------------------------- | ----------------------------------------------------------------------- |
| Full WFM / shift scheduling                    | Huge product                                                            |
| SLA timers / CSAT suites                       | Desk clone                                                              |
| Omnichannel (email/WhatsApp/Slack as channels) | Internship OOS channels                                                 |
| Multiple seat RBAC                             | Needs **P3-TEAMS** — until then **single workspace owner** is the human |
| Platform admin answering user chats            | Admin stays inspect-only                                                |
| Botpress Desk clone                            | Never                                                                   |




### Identity guardrails


| Keep                 | Meaning                                                        |
| -------------------- | -------------------------------------------------------------- |
| Workspace-owned desk | Customer’s inbox, not Aide platform support                    |
| Inspect-only admin   | Admin can see status in inspect; cannot become the human agent |
| Origin lock          | Embed still origin-bound while waiting                         |
| AI resume optional   | Resolve can return to AI or stay closed                        |




### Non-goals (banned in F12)

- Team invites / roles beyond owner  
- Mobile native app  
- Billing  
- Training on private chats

---



## Phase B — Design & functionality ✅

**Delivered (Aug 2026):**

- `lib/services/handoff.service.js` — trigger handoff, human reply, resolve, inbox list
- `lib/validations/desk.js` — request schemas
- APIs:
  - `GET /api/inbox` — workspace waiting threads
  - `POST /api/conversations/[id]/handoff` — owner force handoff
  - `POST /api/conversations/[id]/resolve` — resolve / return to AI
  - `POST /api/conversations/[id]/messages` — owner `HUMAN` reply
  - `POST /api/public/.../conversations/[id]/handoff` — embed customer handoff
- `chat.service` — **AI blocked** when `aiPaused` / `WAITING_HUMAN`; USER messages still saved
- UI: `/inbox`, `/inbox/[id]`, sidebar **Human desk**, `DeskThread` composer + resolve
- Embed: **Talk to a human** button, waiting banner, poll for human replies (~8s)
- Smoke: `npm run test:f12b`

**Manual test:**

1. Embed widget → chat → **Talk to a human**
2. Aide app → **Human desk** → thread appears → reply as human
3. Customer widget shows human bubble (poll)
4. **Return to AI** → bot answers again



### State machine

```
OPEN (AI answers)
  → handoff (user button / model / keyword) → WAITING_HUMAN
  → human replies (still WAITING_HUMAN or IN_PROGRESS)
  → resolve → RESOLVED
  → optional: reopen → OPEN (AI again)
```



### Data model (sketch)

```
Conversation {
  ...existing
  status           // OPEN | WAITING_HUMAN | RESOLVED
  handoffReason    String?
  handoffAt        DateTime?
  assignedUserId   String?   // owner for now
  aiPaused         Boolean @default(false)
}

Message.role: USER | ASSISTANT | HUMAN   // add HUMAN if not present
```



### Triggers


| Trigger                                        | Behavior                                |
| ---------------------------------------------- | --------------------------------------- |
| Embed “Talk to human”                          | Sets WAITING_HUMAN + reason optional    |
| Model tool / intent “handoff”                  | Only if enabled on agent                |
| Keyword list (billing, lawyer, refund dispute) | Suggest or auto-handoff (agent setting) |
| Studio force handoff                           | Owner testing                           |




### Inbox UI (workspace)

- Route e.g. `/inbox` or Agents → **Inbox**
- Filters: Waiting · All · Resolved  
- List: agent name, last message preview, wait time — **no** full history in list  
- Thread: full messages; composer for human  
- Resolve / Return to AI buttons



### Embed / public chat

- While WAITING_HUMAN: show banner “A human will reply soon”  
- AI chat **blocked** until resolve (user messages still saved for human)  
- Human messages appear in **same thread** — customer does not open new app  
- Embed **polls** every ~5–10s for new HUMAN messages (SSE later optional)



### Owner connect flow (detail)

1. Customer triggers handoff on widget
2. `POST /api/.../handoff` → `Conversation.status = WAITING_HUMAN`, `aiPaused = true`
3. Inbox query: `WHERE workspaceId = owner.workspace AND status = WAITING_HUMAN`
4. Owner opens thread → reads USER + ASSISTANT history
5. Owner `POST` message with `role: HUMAN` (requires owner session — customer cannot forge)
6. Public chat fetch returns new HUMAN bubble to customer
7. Owner `POST /resolve` → `RESOLVED` or back to `OPEN` if “return to AI” enabled

**Assigned human (MVP):** always workspace **owner** (`assignedUserId = owner.id`). Teams/multi-seat = later OOS.

### API (sketch)


| Route                                   | Purpose                     |
| --------------------------------------- | --------------------------- |
| `POST /api/conversations/[id]/handoff`  | Trigger                     |
| `POST /api/conversations/[id]/resolve`  | Resolve / resume AI         |
| `GET /api/inbox`                        | List waiting for workspace  |
| `POST /api/conversations/[id]/messages` | Human reply (auth owner)    |
| Public chat                             | Respect `aiPaused` / status |


---



## Phase C — Improvements ✅

**Delivered (Aug 2026):**

- **Nav badge** — waiting count on Human desk (poll ~30s) via `GET /api/inbox/count`
- **Keyword auto-handoff** — embed messages matching phrases (e.g. “talk to human”) → `WAITING_HUMAN` without button
- **Context summary** — last 10 messages as plain-text `handoffSummary` (no LLM cost) on handoff
- **Desk stats** — `GET /api/inbox/count?mode=stats` — waiting, handoffs in range, resolved
- **Inbox auto-refresh** — waiting list polls ~15s
- Idempotent **resolve** when already not waiting
- Smoke: `npm run test:f12c`

**Manual test:** Embed par likho *“I want to speak to human”* → button ke bina handoff. Sidebar badge + inbox summary dekho.

**Deferred (later):** email notify, sound, LLM-compressed summary.

---



## Phase D — Error handling ✅

**Delivered:**

- Handoff **summary fail-safe** — handoff succeeds even if summary build throws
- **Double resolve** idempotent (already)
- Human reply **wrong workspace → 403** (write ops)
- **AI blocked** while `WAITING_HUMAN` (chat.service)
- Public handoff **rate limit** + embed **60s cooldown** after handoff
- **Admin cannot** POST human desk replies
- **RESOLVED → OPEN** when customer sends a new message (reopen thread)

---



## Phase E — Production bottlenecks ✅

**Delivered:**

- Index `(agentId, status, handoffAt)` — migration Phase A
- Inbox list uses `select` (preview fields only, no full row fetch)
- Poll intervals centralized: inbox **10s**, embed **8s** (`lib/desk/desk-config.js`)

---



## Phase F — Scaling ✅

**Delivered:**

- MVP = **workspace owner only** (unchanged)
- **Soft cap warning** when waiting queue ≥ 20 (`queueWarning` in stats + inbox banner)
- Multi-human → **P3-TEAMS** OOS (documented)

---



## Phase G — Infrastructure ✅


| Decision      | Shipped                                      |
| ------------- | -------------------------------------------- |
| Realtime      | Polling (embed 8s, inbox 10s, nav badge 30s) |
| Email         | Deferred — desk works without it             |
| Roles         | `MessageRole.HUMAN` in Prisma                |
| Notifications | In-app nav badge + waiting banner            |


Config: `lib/desk/desk-config.js`

---



## Phase H — Production testing ✅

**Automated:** `npm run test:f12` (a + b + c + d + h)


| Check                                              | Covered by                       |
| -------------------------------------------------- | -------------------------------- |
| Embed user triggers handoff → owner inbox          | Manual + test:f12b               |
| Human reply visible on embed within poll interval  | Manual + embed poll 8s           |
| AI does not answer while WAITING_HUMAN             | test:f12d + chat.service         |
| Resolve → AI can answer again if enabled           | Manual + resolve API             |
| Workspace A never sees Workspace B waiting threads | handoff.service workspace filter |
| Admin cannot send human replies                    | test:f12d + messages route       |
| Keyword / button both paths                        | test:f12c + PublicWebchat        |
| `npm run test:f12` green                           | CI / local                       |




### Done when ✅

Hot issue leaves AI safely; owner replies from workspace inbox; customer sees human message on embed — **without** Botpress Desk.

**Manual demo path:** embed handoff → `/inbox` reply → embed shows human → Return to AI → bot answers again.

---



## Simple examples (product)


| Situation               | Flow                                                |
| ----------------------- | --------------------------------------------------- |
| Angry refund dispute    | User taps Talk to human → owner inbox → typed reply |
| AI unsure after clarify | Model requests handoff → WAITING_HUMAN              |
| Issue done              | Owner Resolve → AI welcome again                    |


---



## Steal (not clone)

Intercom/Zendesk **handoff** — not their full agent workspace, SLA, or omnichannel.

---



## F12-U — Professional Desk upgrades (post-ship)

**Status:** 📋 Plan  
**UI:** ShadCN only · reference: redesign screenshots in `~/Desktop/Redesign` + [Botpress Desk / Human Handoff](https://botpress.com/docs/studio/get-started/manage-your-agent/human-handoff/) · [ADK desk-hitl](https://www.botpress.com/docs/adk-v2/advanced/desk-hitl/)

Botpress Desk patterns to **adapt** (not clone):


| Botpress                      | Aide target                                                                               |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| Ticket queue + status filters | Inbox folders already — add **priority**, **assigned**, **SLA soft timer**                |
| Assign to me / teammate       | MVP was owner-only → **U1:** assign among workspace members (when teams exist) or “claim” |
| Resume chatbot                | Already “Return to AI” — polish copy + banner                                             |
| Priority on startHitl         | Store `handoffPriority` on conversation                                                   |
| Customer name/email on ticket | Capture from embed `setUser` / optional form                                              |




### Phases


| Phase  | Focus               | Done when                                                                                 |
| ------ | ------------------- | ----------------------------------------------------------------------------------------- |
| **U0** | Visual polish       | ✅ Desk shell + mobile folders + hamburger Menu (UI polish Phase 2, Aug 29) |
| **U1** | Claim + presence    | ✅ Claim / Release; claimed-by label; soft lock on composer (Aug 29) |
| **U2** | Priority + filters  | ✅ NORMAL/HIGH/URGENT chips + inbox priority filter (Aug 29) |
| **U3** | Canned replies      | ✅ Default templates insert into desk composer (Aug 29) |
| **U4** | Notes / internal    | ✅ Desk Reply/Note toggle; `INTERNAL` never on embed; **fed to AI as staff context** (not quoted) after Return to AI (Aug 30) |
| **U5** | CSAT after resolve  | ✅ Optional 1–5 in embed after Return to AI / Resolve; Skip ok; re-offer on next handoff (Aug 30) |
| **U6** | Multi-agent (later) | → deferred (L-TEAMS) |


**Out of U-phases:** WhatsApp/Zendesk bridge, full SLA engine, Botpress Desk product clone.

*See also:* `[ARCHITECTURE_ACTIONS_AND_DESK.md](ARCHITECTURE_ACTIONS_AND_DESK.md)` · redesign Desk shots.