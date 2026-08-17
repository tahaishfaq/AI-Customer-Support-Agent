# Phase 2 Backend — Agents + Dashboard Overview

**Scope now:** Protected APIs only (JavaScript)  
**Out of scope now:** Dashboard / Agents UI (→ [`PHASE2_FRONTEND_PLAN.md`](PHASE2_FRONTEND_PLAN.md))  
**App:** `AI-Customer-Support-Agent`  
**Contract:** [`api-contract.md`](api-contract.md) (Agents + `GET /analytics/overview`)

---

## Goal

Authenticated user can:

1. **Create / list / get / update / delete** their own AI agents  
2. Call **dashboard overview** metrics for their agents’ data  

UI comes **after** this backend is tested in Postman.

---

## Why overview is in Phase 2 Backend

SRD dashboard needs:

| Metric | Source (schema) |
|--------|-----------------|
| Total Conversations | `Conversation` count (user’s agents) |
| Total Messages | `Message` count via those conversations |
| Average Response Time | avg `Message.responseTime` where role = ASSISTANT |
| Positive Sentiment % | `Conversation.sentiment = POSITIVE` |
| Negative Sentiment % | `Conversation.sentiment = NEGATIVE` |
| Most Common Topic | mode of `Conversation.category` |

Chat + sentiment tagging come later (Phase 4+). Until then overview still returns **real aggregates** — usually **zeros / null** — so the dashboard UI can wire to one API now.

**Not in this phase:** `/analytics/topics`, `/analytics/sentiment`, `/analytics/trends`, chat, knowledge.

---

## Auth rules (all routes)

- Require JWT: cookie `hapy_token` **or** `Authorization: Bearer <token>`  
- Resolve user via existing `getUserFromRequest`  
- Missing/invalid → **401**  
- Agent belonging to another user → **403**  
- Agent not found → **404**

---

## 1. No schema migration needed

`Agent`, `Conversation`, `Message` models already exist in `prisma/schema.prisma`.

Agent fields:

| Field | Required | Notes |
|-------|----------|--------|
| name | Yes | e.g. `Hapy Support Assistant` |
| description | No | optional string |
| systemPrompt | Yes | instructions for the model (later) |
| welcomeMessage | Yes | e.g. `Hi! How can I help you today?` |

---

## 2. Files to create

```
lib/validations/agent.js          # Zod create + update schemas
lib/services/agent.service.js     # CRUD + ownership
lib/services/analytics.service.js # overview aggregates
lib/require-auth.js               # optional helper: get user or throw 401

app/api/agents/route.js                 # GET list, POST create
app/api/agents/[id]/route.js            # GET, PUT, DELETE
app/api/analytics/overview/route.js     # GET overview KPIs
```

Reuse: `lib/auth.js`, `lib/prisma.js`.  
**Do not** add `lib/api-response.js` — use `NextResponse.json` + HTTP status (see [`NEXT_API_ERROR_CONVENTIONS.md`](NEXT_API_ERROR_CONVENTIONS.md)).  
Route protection pages: `proxy.js` (not middleware).

---

## 3. API routes

| Method | Path | Status |
|--------|------|--------|
| GET | `/api/agents` | 200 `{ agents: [...] }` |
| POST | `/api/agents` | 201 agent object |
| GET | `/api/agents/[id]` | 200 agent object |
| PUT | `/api/agents/[id]` | 200 updated agent |
| DELETE | `/api/agents/[id]` | **204** empty body |
| GET | `/api/analytics/overview` | 200 KPI object |

Optional query later (skip for MVP unless easy): `?agentId=` on overview.

### POST /api/agents — body

```json
{
  "name": "Hapy Support Assistant",
  "description": "AI assistant for answering Hapy customer questions.",
  "systemPrompt": "You are a helpful customer support agent for Hapy...",
  "welcomeMessage": "Hi! How can I help you today?"
}
```

### PUT — partial (all fields optional)

Same keys; only send fields to change.

### GET /api/analytics/overview — response

```json
{
  "totalConversations": 0,
  "totalMessages": 0,
  "averageResponseTimeMs": 0,
  "averageConversationLength": 0,
  "positiveSentimentPercent": 0,
  "negativeSentimentPercent": 0,
  "mostCommonTopic": null
}
```

When data exists: `mostCommonTopic` is a `Category` enum string (`SUPPORT` | `SALES` | `PRICING` | `TECHNICAL` | `GENERAL`).

---

## 4. Validation (Zod)

**Create**

- `name`: trim, min 1  
- `description`: optional string (allow empty → store null)  
- `systemPrompt`: trim, min 1  
- `welcomeMessage`: trim, min 1  

**Update**

- Same fields, all optional; at least one field required (or allow empty body as no-op — prefer “at least one”).

Errors: `400` + `{ error: { message, details } }` (same as auth).

---

## 5. Service rules

### Agents

1. Always scope queries with `userId = currentUser.id`  
2. `getAgentForUser(id, userId)` — not found → 404; found but wrong user → treat as 404 **or** 403 (prefer **403** if id exists for another user; simpler MVP: **404** for both to avoid leaking ids — **choose 403 when owned-by-other is detectable**, else 404)  
3. Delete: Prisma cascade removes knowledge + conversations + messages  

### Overview

1. Find all `agentId`s for user  
2. Aggregate conversations / messages for those agents only  
3. Empty agent list → all zeros / `mostCommonTopic: null`

---

## 6. Implementation order

1. `requireAuth` helper (if useful)  
2. Agent Zod + `agent.service`  
3. `GET/POST /api/agents`  
4. `GET/PUT/DELETE /api/agents/[id]`  
5. `analytics.service` + `GET /api/analytics/overview`  
6. Postman test checklist below  

---

## 7. How to test (Postman)

1. Login → copy JWT (cookie or body `token`)  
2. `POST /api/agents` with Bearer token → 201  
3. `GET /api/agents` → includes new agent  
4. `GET /api/agents/:id` → 200  
5. `PUT /api/agents/:id` → updated fields  
6. `GET /api/analytics/overview` → zeros (no chats yet)  
7. `DELETE /api/agents/:id` → 204; GET again → 404  
8. No token → 401  
9. Another user’s agent id (if available) → 403/404  

---

## Phase 2 Backend checklist

- [x] Agents list / create / get / update / delete work  
- [x] Ownership / auth errors correct  
- [x] Overview returns zeros with no conversations  
- [x] Validation errors return 400 details  
- [x] **PHASE 2 BACKEND DONE** → start frontend plan  

---

## Out of scope

- Knowledge PDF/text APIs (Phase 3)  
- Chat / OpenAI (Phase 4)  
- Full analytics charts (later)  
- Dashboard React pages (frontend plan)
