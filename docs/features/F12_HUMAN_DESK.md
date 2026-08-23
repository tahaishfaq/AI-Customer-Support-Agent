# F12 — Human desk handoff (alt next after F00)

**Status:** ⏳ Later P3 — open instead of F11 only if product/demo story is **human escalation**. Prefer **F11** first unless lead says otherwise.  
**Goal:** Escalate live chats to a **human inbox inside the customer workspace** (not platform admin). Resume AI optional.  
**Maps to:** P3-DESK · Fin/Zendesk/Botpress handoff lite.  
**Prerequisite:** Conversations + embed + studio already shipped. F08/F09 unchanged for AI turns.

> **Deliverables rule:** When a phase is marked ✅, add **Delivered** and **Manual test**.

---

## Why add this feature?

| Reason | Detail |
|--------|--------|
| Real support teams | AI stuck → human takes over |
| Trust | High-risk topics (billing dispute, legal) need person |
| Competitor story | Desk handoff without building full Zendesk |

### When **not** to open F12

| Situation | Do instead |
|-----------|------------|
| Need “bot calls API” wow | **F11** |
| Huge KB wrong chunks | **F10** |
| DoD / demo incomplete | **F00** |
| Multi-agent staffing / SLA / WhatsApp | OOS later (Teams / Channels) |

---

## Phase A — Scope & identity

### In

- Conversation status: `OPEN` | `WAITING_HUMAN` | `RESOLVED` (names exact TBD in Prisma)
- User or model can trigger **handoff**
- Workspace **inbox** for owner: list waiting threads
- Human reply as `HUMAN` (or `ASSISTANT` with flag) — visible on embed + studio
- Context handoff: last N messages + optional AI summary + reason
- Risk filters lite: keywords → suggest handoff
- Cross-workspace isolation

### Out

| Out | Why |
|-----|-----|
| Full WFM / shift scheduling | Huge product |
| SLA timers / CSAT suites | Desk clone |
| Omnichannel (email/WhatsApp/Slack as channels) | Internship OOS channels |
| Multiple seat RBAC | Needs **P3-TEAMS** — until then **single workspace owner** is the human |
| Platform admin answering user chats | Admin stays inspect-only |
| Botpress Desk clone | Never |

### Identity guardrails

| Keep | Meaning |
|------|---------|
| Workspace-owned desk | Customer’s inbox, not Hapy platform support |
| Inspect-only admin | Admin can see status in inspect; cannot become the human agent |
| Origin lock | Embed still origin-bound while waiting |
| AI resume optional | Resolve can return to AI or stay closed |

### Non-goals (banned in F12)

- Team invites / roles beyond owner  
- Mobile native app  
- Billing  
- Training on private chats  

---

## Phase B — Design & functionality

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

| Trigger | Behavior |
|---------|----------|
| Embed “Talk to human” | Sets WAITING_HUMAN + reason optional |
| Model tool / intent “handoff” | Only if enabled on agent |
| Keyword list (billing, lawyer, refund dispute) | Suggest or auto-handoff (agent setting) |
| Studio force handoff | Owner testing |

### Inbox UI (workspace)

- Route e.g. `/inbox` or Agents → **Inbox**
- Filters: Waiting · All · Resolved  
- List: agent name, last message preview, wait time — **no** full history in list  
- Thread: full messages; composer for human  
- Resolve / Return to AI buttons  

### Embed / public chat

- While WAITING_HUMAN: show banner “A human will reply soon”  
- AI chat **blocked** until resolve (or queue user messages for human only)  
- Human messages appear in same thread  

### API (sketch)

| Route | Purpose |
|-------|---------|
| `POST /api/conversations/[id]/handoff` | Trigger |
| `POST /api/conversations/[id]/resolve` | Resolve / resume AI |
| `GET /api/inbox` | List waiting for workspace |
| `POST /api/conversations/[id]/messages` | Human reply (auth owner) |
| Public chat | Respect `aiPaused` / status |

---

## Phase C — Improvements

- Handoff summary: last 10 messages compressed by LLM (optional, cost-aware)
- Email notify owner when handoff created (Resend/Postmark later)
- Badge count on nav (waiting count)
- Sound / desktop notification later (not required)
- Analytics: handoff rate, time-to-first-human-reply

---

## Phase D — Error handling

| Case | Behavior |
|------|----------|
| Handoff while owner offline | Queue WAITING_HUMAN; email when configured |
| Double resolve | Idempotent |
| Human reply on wrong workspace | 403 |
| AI replies while WAITING_HUMAN | Blocked server-side |
| Embed user spams handoff | Rate limit |
| Summary LLM fail | Handoff still works; skip summary |

---

## Phase E — Production bottlenecks

- Index: `(workspaceId, status, handoffAt)`  
- Inbox list: select preview fields only  
- No N+1 on messages in list  
- Polling every 5–10s for inbox (SSE later)

---

## Phase F — Scaling

- Multiple humans → requires **P3-TEAMS** (members) — out of F12 MVP  
- Until then: workspace **owner** is the only desk agent  
- Soft cap: waiting queue length warning  

---

## Phase G — Infrastructure

| Decision | Recommendation |
|----------|----------------|
| Realtime | Polling first; SSE optional later |
| Email | Optional provider; feature works without it |
| Roles | Message.role `HUMAN` in Prisma enum migration |
| Notifications | In-app badge first |

---

## Phase H — Production testing

- [ ] Embed user triggers handoff → appears in owner inbox  
- [ ] Human reply visible on embed within poll interval  
- [ ] AI does not answer while WAITING_HUMAN  
- [ ] Resolve → AI can answer again if enabled  
- [ ] Workspace A never sees Workspace B waiting threads  
- [ ] Admin cannot send human replies as the customer  
- [ ] Keyword / button both paths covered  
- [ ] `npm run test:f12` (to add) green  

### Done when

Hot issue leaves AI safely; owner replies from workspace inbox; customer sees human message on embed — **without** Botpress Desk.

---

## Implementation order (when coding starts)

1. Prisma status + HUMAN role + migration  
2. Handoff / resolve / human message APIs  
3. Block AI in chat.service when paused  
4. Inbox list + thread UI  
5. Embed banner + “Talk to human”  
6. Optional email + analytics counters  
7. Phase H checklist  

---

## Simple examples (product)

| Situation | Flow |
|-----------|------|
| Angry refund dispute | User taps Talk to human → owner inbox → typed reply |
| AI unsure after clarify | Model requests handoff → WAITING_HUMAN |
| Issue done | Owner Resolve → AI welcome again |

---

## Steal (not clone)

Intercom/Zendesk **handoff** — not their full agent workspace, SLA, or omnichannel.
