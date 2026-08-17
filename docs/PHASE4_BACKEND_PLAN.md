# Phase 5 — Chat + Conversations (Backend)

> **Renumber note:** Yeh plan pehle “Phase 4” tha. Ab fullstack mein yeh **Phase 5** hai.  
> Naya **Phase 4** = Botpress-like redesign → [`PHASE4_REDESIGN_PLAN.md`](PHASE4_REDESIGN_PLAN.md).  
> Filename `PHASE4_BACKEND_PLAN.md` legacy hai — content = Chat backend.

**Scope now:** Protected APIs only (JavaScript)  
**Out of scope now:** Chat / conversations UI (→ [`PHASE4_FRONTEND_PLAN.md`](PHASE4_FRONTEND_PLAN.md) — also Phase 5 FE)  
**App:** `AI-Customer-Support-Agent`  
**Contract:** [`api-contract.md`](api-contract.md) (Chat + Conversations sections)  
**Depends on:** Phase 3 knowledge APIs + NextAuth session (`requireAuth`)

---

## Goal

Authenticated user can, **for their own agents**:

1. **Send a chat message** → get an AI reply (OpenAI)  
2. **Start or continue** a conversation (`conversationId` optional)  
3. **Persist** USER + ASSISTANT messages (with `responseTime` on assistant)  
4. **Classify** conversation `category` + `sentiment` and save on Conversation  
5. **List** conversations (paginated, optional `agentId` filter)  
6. **Get** one conversation with full message history  

UI comes **after** this backend is tested (Postman / curl).

---

## Why this phase matters

This is the core product loop:

```
Agent + Knowledge → Chat → Stored messages → Category/Sentiment → (Phase 5 analytics)
```

Phase 4 uses knowledge as a **simple text join** in the prompt.  
**No** vector DB / embeddings / RAG for MVP.

---

## Auth & ownership rules (all routes)

- Use existing `requireAuth()` → NextAuth `auth()` session  
- Missing/invalid session → **401**  
- Agent must belong to current user → else **403** / **404**  
- Conversation must belong to an agent owned by current user → else **403** / **404**  
- Same error body: `{ error: { message, details } }`  
- Use `NextResponse.json` — **no** Express-style helpers  
- See [`NEXT_API_ERROR_CONVENTIONS.md`](NEXT_API_ERROR_CONVENTIONS.md)

---

## 1. No new Prisma models

`Conversation` + `Message` already exist in `prisma/schema.prisma`:

### Conversation

| Field | Type | Notes |
|-------|------|--------|
| id | cuid | |
| agentId | string | FK → Agent (cascade) |
| category | `Category?` | set after classify |
| sentiment | `Sentiment?` | set after classify |
| startedAt | DateTime | default now |
| endedAt | DateTime? | optional; leave null for MVP |
| createdAt | DateTime | |

### Message

| Field | Type | Notes |
|-------|------|--------|
| id | cuid | |
| conversationId | string | FK → Conversation (cascade) |
| role | `MessageRole` | `USER` \| `ASSISTANT` |
| content | string | |
| responseTime | Int? | ms; **assistant only** |
| createdAt | DateTime | |

Enums already include: `MessageRole`, `Category`, `Sentiment`.

**No migration needed.**

---

## 2. Env + packages

### `.env` (required for chat)

```bash
OPENAI_API_KEY=sk-...
```

Optional later:

```bash
OPENAI_MODEL=gpt-4o-mini   # default if unset
```

Update `.env.example` if the key comment is missing (already present).

### Packages

```bash
npm install openai
```

Use official `openai` SDK in a thin provider wrapper (easy to swap later).

---

## 3. Files to create

```
lib/validations/chat.js              # Zod: message + optional conversationId
lib/services/ai/llm.provider.js      # chatCompletion({ system, messages }) → { content, latencyMs }
lib/services/ai/classify.js          # classifyCategoryAndSentiment(text) → { category, sentiment }
lib/services/chat.service.js         # sendMessage flow (create/continue conversation)
lib/services/conversation.service.js # listConversations, getConversationForUser

app/api/agents/[id]/chat/route.js    # POST
app/api/conversations/route.js       # GET list
app/api/conversations/[id]/route.js  # GET detail
```

Reuse:

- `lib/require-auth.js`  
- `lib/services/agent.service.js` → `getAgentForUser`  
- `lib/services/knowledge.service.js` → list docs for agent (or prisma directly in chat service)  
- `lib/prisma.js`

---

## 4. API routes

| Method | Path | Status | Body / query |
|--------|------|--------|----------------|
| POST | `/api/agents/[id]/chat` | **200** | `{ message, conversationId? }` |
| GET | `/api/conversations` | 200 | `?agentId&limit&offset` |
| GET | `/api/conversations/[id]` | 200 | full conversation + messages |

Note: Chat returns **200** (not 201) per api-contract — conversation may be new or continued.

---

## 5. `POST /api/agents/[id]/chat`

### Request

```json
{
  "message": "How much does your service cost?",
  "conversationId": "optional-cuid"
}
```

| Field | Rules |
|-------|--------|
| message | required, trim, min 1 |
| conversationId | optional string (cuid) |

### Chat flow (implement exactly)

```
1. requireAuth → userId
2. getAgentForUser(agentId, userId) → 404/403 if bad
3. If conversationId provided:
     - load conversation; must exist + agentId match + agent owned by user
     - else 404 / 403
   Else:
     - create Conversation { agentId }
4. Save USER Message { role: USER, content: message }
5. Load agent.systemPrompt + agent.welcomeMessage (welcome for UI; prompt uses systemPrompt)
6. Load ALL knowledge docs for agent → join into one knowledge block
7. Load recent messages for this conversation (e.g. last 20, oldest→newest)
8. Build OpenAI messages:
     - system = systemPrompt + "\n\nKnowledge:\n" + knowledgeText
     - history = prior USER/ASSISTANT turns (exclude the just-saved user msg or include it once — pick one consistent approach)
9. Call llm.provider → assistant text + measure responseTime (ms)
10. Save ASSISTANT Message { role: ASSISTANT, content, responseTime }
11. Classify category + sentiment from latest user message (or user+assistant pair)
12. Update Conversation { category, sentiment }
13. Return JSON (api-contract shape)
```

### Response 200

```json
{
  "conversationId": "clxconv001",
  "message": {
    "id": "clxmsg002",
    "role": "ASSISTANT",
    "content": "...",
    "responseTime": 1820,
    "createdAt": "..."
  },
  "userMessage": {
    "id": "clxmsg001",
    "role": "USER",
    "content": "...",
    "createdAt": "..."
  },
  "category": "PRICING",
  "sentiment": "NEUTRAL"
}
```

### Knowledge in prompt (MVP)

```
## Agent knowledge
### {doc.name} ({type})
{doc.content}

### ...
```

If no knowledge docs: still chat using `systemPrompt` only (do not fail).

### Prompt size guard (simple)

- Cap total knowledge chars (e.g. **12_000**) — truncate with `"...(truncated)"`  
- Cap history to last **N** messages (e.g. **20**)  
- No embeddings

### LLM errors

- Missing `OPENAI_API_KEY` → **500** `{ error: { message: "AI is not configured" } }`  
- OpenAI failure → **502** or **500** with safe message (no raw API key / stack in body)  
- Still keep USER message saved if you already wrote it; optional: do not save ASSISTANT on failure (preferred)

---

## 6. Classification

**Categories:** `SUPPORT` | `SALES` | `PRICING` | `TECHNICAL` | `GENERAL`  
**Sentiment:** `POSITIVE` | `NEUTRAL` | `NEGATIVE`

MVP options (pick one, document in code comment):

| Approach | Notes |
|----------|--------|
| **A) Second small OpenAI call** | JSON-only reply; most accurate |
| **B) Heuristic keywords** | Faster/cheaper; OK for demo if OpenAI budget tight |

Prefer **A** for internship demo quality. On classify failure → default `GENERAL` + `NEUTRAL` (never fail the chat).

Update conversation on **every** successful chat turn (latest classification wins).

---

## 7. `GET /api/conversations`

Query:

| Param | Default | Rules |
|-------|---------|--------|
| agentId | — | optional; must be owned by user if provided |
| limit | 20 | max 100 |
| offset | 0 | ≥ 0 |

Rules:

- Only conversations whose `agent.userId === current user`  
- Order: newest first (`startedAt desc` or `createdAt desc`)  
- Include `messageCount`, nested `agent: { id, name }`  
- Return `{ conversations, total, limit, offset }`

---

## 8. `GET /api/conversations/[id]`

- Load conversation + agent + messages (`createdAt asc`)  
- Ownership via agent.userId  
- 404 if missing; 403 if other user’s  
- Return full api-contract shape (no pagination on messages for MVP)

---

## 9. Validation (Zod)

```js
// chatMessageSchema
{
  message: z.string().trim().min(1),
  conversationId: z.string().cuid().optional() // or z.string().min(1).optional()
}

// listConversationsQuerySchema
{
  agentId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
}
```

Errors: **400** + `{ error: { message: "Validation failed", details } }`

---

## 10. Service rules

1. Always ownership-check agent before chat  
2. Never allow chatting against another user’s `conversationId` even if you guess the id  
3. `responseTime` only on ASSISTANT messages  
4. Do not expose OpenAI raw errors to clients  
5. Keep provider swappable: UI/API never import `openai` directly — only `llm.provider.js`

---

## 11. Implementation order

1. Install `openai` + confirm `OPENAI_API_KEY` in `.env`  
2. `llm.provider.js` + `classify.js`  
3. Zod + `chat.service.js`  
4. `POST /api/agents/[id]/chat`  
5. `conversation.service.js`  
6. `GET /api/conversations` + `GET /api/conversations/[id]`  
7. Postman / curl checklist below  

---

## 12. How to test (Postman / curl)

1. Login (NextAuth session cookie)  
2. Create agent + add TEXT knowledge (Phase 2–3)  
3. `POST /api/agents/:id/chat` **without** `conversationId` → **200**, new id, ASSISTANT reply  
4. Same route **with** returned `conversationId` → multi-turn; history used  
5. Prisma Studio / Neon: USER + ASSISTANT rows; conversation has category + sentiment  
6. Assistant `responseTime` is a positive int  
7. `GET /api/conversations` → list includes chat  
8. `GET /api/conversations/:id` → messages ordered  
9. Wrong agent / other user’s conversation → **403** / **404**  
10. No session → **401**  
11. Empty message → **400**  
12. Missing OpenAI key (temp unset) → clear **500** (optional local check)

---

## Phase 4 Backend checklist

- [x] Chat API returns AI reply (200)  
- [x] Creates conversation when `conversationId` omitted  
- [x] Continues conversation when id provided  
- [x] USER + ASSISTANT messages saved  
- [x] `responseTime` saved on assistant  
- [x] Knowledge text included in prompt (when docs exist)  
- [x] Category + sentiment saved on conversation  
- [x] `GET /api/conversations` list works  
- [x] `GET /api/conversations/[id]` detail works  
- [x] Ownership / auth errors correct (401 / 403 / 404)  
- [x] Validation errors return 400 details  
- [x] **PHASE 4 BACKEND DONE** → start frontend plan  

---

## Out of scope

- Chat / conversations UI (frontend plan)  
- Streaming tokens (SSE / websockets)  
- Vector search / embeddings / RAG  
- Rate limiting (Phase 6 polish)  
- Ending conversations (`endedAt`) UI  
- Analytics charts (Phase 5)  
- Guest / public embed widget  
