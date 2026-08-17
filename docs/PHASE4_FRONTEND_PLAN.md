# Phase 5 — Chat + Conversations (Frontend)

> **Renumber note:** Yeh plan pehle “Phase 4” tha. Ab fullstack mein yeh **Phase 5** hai.  
> Naya **Phase 4** = redesign → [`PHASE4_REDESIGN_PLAN.md`](PHASE4_REDESIGN_PLAN.md).

**Scope now:** UI only (JavaScript / JSX)  
**Depends on:** [`PHASE4_BACKEND_PLAN.md`](PHASE4_BACKEND_PLAN.md) APIs (Chat backend) tested first  
**App:** `AI-Customer-Support-Agent`  
**Visual language:** Hapy teal + Phase 4 Botpress-like shell (after redesign)  
**Auth:** NextAuth session (`credentials: "include"` via `apiFetch`)

---

## Goal

User can talk to an agent and review past chats:

1. Open **Chat** → pick an agent → send messages (multi-turn)  
2. See welcome message, loading state, errors + retry  
3. Keep `conversationId` in client state for the active thread  
4. Browse **Conversations** list  
5. Open a conversation **detail** (read-only message history)

---

## User stories

1. Nav **Chat** → choose agent → see welcome → ask a question → AI replies  
2. Send follow-ups in the same thread (same `conversationId`)  
3. Start a **New chat** (clear id + messages; show welcome again)  
4. Nav / link to **Conversations** → see recent threads with category/sentiment  
5. Open one conversation → full transcript  
6. From agent detail, optional **Chat** CTA → `/chat?agentId=...`

---

## Routes (App Router)

| Path | Page |
|------|------|
| `/chat` | Live chat (replace Phase 2 stub) |
| `/conversations` | Conversation list |
| `/conversations/[id]` | Conversation detail |

All under existing `app/(app)/` layout (header + auth).

### Proxy / matcher updates

`proxy.js` currently protects `/chat` but **not** `/conversations`.

Add:

```js
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/agents",
  "/chat",
  "/conversations",  // NEW
  "/analytics",
];
```

And matcher entries:

```js
"/conversations",
"/conversations/:path*",
```

### Entry points (update existing UI)

| Place | Change |
|-------|--------|
| Header nav | Keep **Chat**; add **Conversations** (or put under Chat submenu — prefer top-level link for clarity) |
| `/chat` stub | Replace with real chat UI |
| Agent card / detail | Enable **Chat** link → `/chat?agentId={id}` |
| Dashboard shortcuts | Point Chat shortcut to live page (already `/chat`) |
| Agents “soon” copy | Remove Chat-soon hints |

---

## 1. Chat page layout (`/chat`)

Botpress-inspired, one clear composition:

```
┌─────────────────────────────────────────────┐
│ Agent: [ dropdown ▾ ]          [ New chat ] │
├─────────────────────────────────────────────┤
│                                             │
│  (AI)  Welcome message…                     │
│                                             │
│                    User message…       (you)│
│                                             │
│  (AI)  Assistant reply…                     │
│                                             │
│  (AI)  • • •  (loading)                     │
│                                             │
├─────────────────────────────────────────────┤
│ [ Type a message…                    ] [➤]  │
└─────────────────────────────────────────────┘
```

### Behaviors

| Piece | Behavior |
|-------|----------|
| Agent dropdown | `listAgents()` on load; if `?agentId=` present, select it |
| No agents | Empty state → CTA to `/agents/new` |
| Welcome | Show `agent.welcomeMessage` as first AI bubble (local only — not from API until first real reply) |
| Send | Disable while loading; clear input after send |
| Multi-turn | Persist `conversationId` from first successful response |
| New chat | Reset `conversationId`, messages → welcome only |
| Loading | Typing dots / skeleton bubble on AI side |
| Error | Inline banner under composer + **Retry** last message |
| Scroll | Auto-scroll to latest message |

### Message alignment

- USER → right (teal / primary soft)  
- ASSISTANT → left (surface / muted)  
- Optional small meta under AI: response time (`1.8s`) when available  

### API call

```js
POST /api/agents/:agentId/chat
{ message, conversationId? }  // omit conversationId on first message
```

On success:

1. Append `userMessage` + `message` (assistant) to UI list  
2. Store `conversationId`  
3. Optionally show category/sentiment chip in header (nice-to-have)

Do **not** call classify from the client — server already returns values.

---

## 2. Conversations list (`/conversations`)

```
Conversations
Filter by agent: [ All agents ▾ ]

─────────────────────────────
Hapy Support Assistant
PRICING · NEUTRAL · 4 messages
Started Aug 10, 2026
```

### Features

- Load `GET /api/conversations`  
- Optional agent filter → `?agentId=`  
- Show: agent name, category, sentiment, messageCount, startedAt  
- Click row → `/conversations/[id]`  
- States: loading skeletons, empty (“No conversations yet. Start a chat.”), error + retry  
- Pagination: MVP = “Load more” if `total > limit` (or simple next page)

---

## 3. Conversation detail (`/conversations/[id]`)

```
← Back to conversations
Agent name · CATEGORY · SENTIMENT

[ message bubbles — read only ]
```

- `GET /api/conversations/:id`  
- Same bubble styles as chat (no composer)  
- 404 / 403 → friendly error + link back  

Optional (nice-to-have): **Continue in chat** → `/chat?agentId=...&conversationId=...`  
(Only if you also teach chat page to hydrate history via detail API — otherwise skip for MVP.)

**MVP recommendation:** detail is **read-only**. Continue = start new chat with same agent.

---

## 4. Files to create / update

```
# API helpers
lib/api/chat.js
  - sendChatMessage(agentId, { message, conversationId? })

lib/api/conversations.js
  - listConversations({ agentId?, limit?, offset? })
  - getConversation(id)

# Chat components
components/chat/ChatPage.jsx            # or keep logic in page
components/chat/AgentPicker.jsx
components/chat/MessageList.jsx
components/chat/MessageBubble.jsx
components/chat/ChatComposer.jsx
components/chat/TypingIndicator.jsx

# Conversations components
components/conversations/ConversationList.jsx
components/conversations/ConversationRow.jsx
components/conversations/ConversationDetail.jsx

# Pages
app/(app)/chat/page.jsx                      # replace stub
app/(app)/conversations/page.jsx             # NEW
app/(app)/conversations/[id]/page.jsx        # NEW

# Wire entry points
components/layout/...                        # nav: Conversations
components/agents/AgentCard.jsx              # Chat link
app/(app)/agents/[id]/page.jsx               # Chat CTA
proxy.js                                     # protect /conversations
```

---

## 5. Implementation order (after backend DONE)

1. `lib/api/chat.js` + `lib/api/conversations.js`  
2. Replace `/chat` stub: agent picker + welcome + composer (local state only)  
3. Wire send → append messages + keep `conversationId`  
4. Loading / error / retry / New chat  
5. Conversations list page  
6. Conversation detail page  
7. Nav + agent entry links + `proxy.js`  
8. Browser E2E: agent + knowledge → multi-turn chat → list → detail  

---

## 6. Design notes

- Same CSS vars / rounded panels as dashboard  
- Chat area: one tall panel, not a dashboard of cards  
- Avoid purple / glow / emoji decoration  
- Mobile: full-width composer; agent picker stacks above messages  
- Keep header sticky; chat body scrolls inside panel if needed  
- Sentiment/category badges: soft teal / slate / rose (match MetricCard tones)

---

## 7. Query params (chat)

| Param | Use |
|-------|-----|
| `agentId` | Pre-select agent from agent detail / card |
| `conversationId` | **Skip for MVP** unless you implement history hydrate |

---

## Phase 4 Frontend checklist

- [x] `/chat` works with agent picker + welcome  
- [x] Send message → AI reply appears  
- [x] Multi-turn keeps `conversationId`  
- [x] Loading dots + error/retry  
- [x] New chat resets thread  
- [x] `/conversations` list works  
- [x] `/conversations/[id]` detail works  
- [x] Nav + agent Chat links wired  
- [x] `/conversations` protected in `proxy.js`  
- [ ] Full flow tested in browser *(needs `OPENAI_API_KEY` + login)*  
- [ ] **PHASE 4 FRONTEND DONE**  

---

## Out of scope

- Streaming / typewriter token UI  
- Editing / deleting messages  
- Public embed widget  
- Analytics charts (Phase 5)  
- Re-opening old thread into live composer (nice-to-have)  
- Voice / attachments in chat  
