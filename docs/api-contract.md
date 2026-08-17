# Hapy API Contract

Base URL: `http://localhost:4000/api` (development)

All protected routes require:

```
Authorization: Bearer <jwt>
```

## Error format

```json
{
  "error": {
    "message": "Human-readable message",
    "details": {}
  }
}
```

| Status | When |
|--------|------|
| 400 | Validation failed |
| 401 | Missing or invalid token |
| 403 | Not allowed to access resource |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate email) |
| 500 | Server error |

---

## Health

### `GET /health`

Public. No auth.

**Response 200**

```json
{
  "status": "ok",
  "service": "hapy-api",
  "timestamp": "2026-08-10T12:00:00.000Z"
}
```

---

## Auth

### `POST /auth/register`

Public.

**Request body**

```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "securePass123",
  "confirmPassword": "securePass123"
}
```

| Field | Type | Rules |
|-------|------|-------|
| name | string | required, min 1 |
| email | string | valid email, unique |
| password | string | min 8 characters |
| confirmPassword | string | must match password |

**Response 201**

```json
{
  "user": {
    "id": "clx123abc",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "createdAt": "2026-08-10T12:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:** 400 validation, 409 email already exists

---

### `POST /auth/login`

Public.

**Request body**

```json
{
  "email": "jane@example.com",
  "password": "securePass123"
}
```

**Response 200**

```json
{
  "user": {
    "id": "clx123abc",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "createdAt": "2026-08-10T12:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:** 400 validation, 401 invalid credentials

> **Cookies (browser):** On success, the API also sets an httpOnly cookie `hapy_token`. Browser clients should call APIs with `credentials: "include"`. Protected routes accept the cookie **or** `Authorization: Bearer <jwt>`.

---

### `POST /auth/logout`

Protected. Client-side token discard; optional server-side invalidation in future.

**Response 200**

```json
{
  "message": "Logged out successfully"
}
```

---

### `POST /auth/google`

Public. Sign in / register with a Google ID token (Google Identity Services credential).

**Request body**

```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

| Field | Type | Rules |
|-------|------|-------|
| idToken | string | required; verified with `GOOGLE_CLIENT_ID` |

**Behavior**

- Verifies Google ID token
- Finds user by `googleId`, or links by email, or creates Google-only user (`passwordHash` null)
- Returns the same shape as login

**Response 200**

```json
{
  "user": {
    "id": "clx123abc",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "createdAt": "2026-08-10T12:00:00.000Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Errors:** 400 validation, 401 invalid Google token, 500 Google not configured

---

### `GET /auth/me`

Protected. Returns the authenticated user.

**Response 200**

```json
{
  "user": {
    "id": "clx123abc",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "createdAt": "2026-08-10T12:00:00.000Z"
  }
}
```

**Errors:** 401 missing or invalid token

---

## Agents

All agent routes require auth. Users may only access their own agents.

### `GET /agents`

List agents for the authenticated user.

**Response 200**

```json
{
  "agents": [
    {
      "id": "clx456def",
      "userId": "clx123abc",
      "name": "Hapy Support Assistant",
      "description": "AI assistant for answering Hapy customer questions.",
      "systemPrompt": "You are a helpful customer support agent for Hapy...",
      "welcomeMessage": "Hi! How can I help you today?",
      "createdAt": "2026-08-10T12:00:00.000Z",
      "updatedAt": "2026-08-10T12:00:00.000Z"
    }
  ]
}
```

---

### `POST /agents`

**Request body**

```json
{
  "name": "Hapy Support Assistant",
  "description": "AI assistant for answering Hapy customer questions.",
  "systemPrompt": "You are a helpful customer support agent for Hapy...",
  "welcomeMessage": "Hi! How can I help you today?"
}
```

| Field | Type | Rules |
|-------|------|-------|
| name | string | required |
| description | string | optional |
| systemPrompt | string | required |
| welcomeMessage | string | required |

**Response 201** — single agent object (same shape as list item)

---

### `GET /agents/:id`

**Response 200** — single agent object

**Errors:** 404 not found, 403 not owner

---

### `PUT /agents/:id`

**Request body** — partial update; all fields optional:

```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "systemPrompt": "Updated prompt",
  "welcomeMessage": "Hello!"
}
```

**Response 200** — updated agent object

---

### `DELETE /agents/:id`

**Response 204** — no body

---

## Knowledge

### `GET /agents/:id/knowledge`

List knowledge documents for an agent.

**Response 200**

```json
{
  "documents": [
    {
      "id": "clx789ghi",
      "agentId": "clx456def",
      "name": "Services FAQ",
      "type": "TEXT",
      "content": "Q: What services does Hapy provide?\nA: ...",
      "fileUrl": null,
      "cloudinaryPublicId": null,
      "createdAt": "2026-08-10T12:00:00.000Z",
      "updatedAt": "2026-08-10T12:00:00.000Z"
    },
    {
      "id": "clx789xyz",
      "agentId": "clx456def",
      "name": "Product Guide.pdf",
      "type": "PDF",
      "content": "Extracted text from PDF...",
      "fileUrl": "https://res.cloudinary.com/demo/raw/upload/v1/hapy/knowledge/guide.pdf",
      "cloudinaryPublicId": "hapy/knowledge/guide",
      "createdAt": "2026-08-10T12:05:00.000Z",
      "updatedAt": "2026-08-10T12:05:00.000Z"
    }
  ]
}
```

`type` enum: `PDF` | `TEXT`  
PDF files are stored on **Cloudinary**; DB keeps `fileUrl` + `cloudinaryPublicId` + extracted `content` (for chat). TEXT docs have `fileUrl` / `cloudinaryPublicId` as `null`.

---

### `POST /agents/:id/knowledge`

Add knowledge via JSON (text/FAQ) or multipart upload (PDF).

#### Text / FAQ (`Content-Type: application/json`)

**Request body**

```json
{
  "name": "Services FAQ",
  "type": "TEXT",
  "content": "Q: What services does Hapy provide?\nA: Hapy provides custom software development..."
}
```

**Response 201** — single document object

#### PDF upload (`Content-Type: multipart/form-data`)

| Field | Type | Rules |
|-------|------|-------|
| file | file | PDF only, max size TBD (e.g. 10MB) |
| name | string | optional display name; defaults to filename |

**Flow:** upload PDF to Cloudinary → extract text with `pdf-parse` → save metadata + `fileUrl` + extracted `content` in DB (binary not stored in Postgres).

**Response 201** — document with `type: "PDF"`, `fileUrl`, `cloudinaryPublicId`, and extracted `content`

Requires `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

---

### `DELETE /knowledge/:id`

**Response 204** — no body

**Errors:** 404, 403 if document belongs to another user's agent

---

## Chat

### `POST /agents/:id/chat`

Send a user message and receive an AI response. Creates or continues a conversation.

**Request body**

```json
{
  "message": "How much does your software development service cost?",
  "conversationId": "clxconv001"
}
```

| Field | Type | Rules |
|-------|------|-------|
| message | string | required, non-empty |
| conversationId | string | optional; omit to start new conversation |

**Response 200**

```json
{
  "conversationId": "clxconv001",
  "message": {
    "id": "clxmsg002",
    "role": "ASSISTANT",
    "content": "Our software development pricing depends on project scope...",
    "responseTime": 1820,
    "createdAt": "2026-08-10T12:10:02.000Z"
  },
  "userMessage": {
    "id": "clxmsg001",
    "role": "USER",
    "content": "How much does your software development service cost?",
    "createdAt": "2026-08-10T12:10:00.000Z"
  },
  "category": "PRICING",
  "sentiment": "NEUTRAL"
}
```

`role` enum: `USER` | `ASSISTANT`  
`category` enum: `SUPPORT` | `SALES` | `PRICING` | `TECHNICAL` | `GENERAL`  
`sentiment` enum: `POSITIVE` | `NEUTRAL` | `NEGATIVE`  
`responseTime` — milliseconds for AI reply (assistant messages only)

---

## Conversations

### `GET /conversations`

List conversations for the authenticated user's agents.

**Query params**

| Param | Type | Description |
|-------|------|-------------|
| agentId | string | optional filter |
| limit | number | default 20, max 100 |
| offset | number | default 0 |

**Response 200**

```json
{
  "conversations": [
    {
      "id": "clxconv001",
      "agentId": "clx456def",
      "category": "PRICING",
      "sentiment": "NEUTRAL",
      "startedAt": "2026-08-10T12:10:00.000Z",
      "endedAt": null,
      "createdAt": "2026-08-10T12:10:00.000Z",
      "messageCount": 4,
      "agent": {
        "id": "clx456def",
        "name": "Hapy Support Assistant"
      }
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

---

### `GET /conversations/:id`

Full conversation with messages.

**Response 200**

```json
{
  "id": "clxconv001",
  "agentId": "clx456def",
  "category": "PRICING",
  "sentiment": "NEUTRAL",
  "startedAt": "2026-08-10T12:10:00.000Z",
  "endedAt": null,
  "createdAt": "2026-08-10T12:10:00.000Z",
  "agent": {
    "id": "clx456def",
    "name": "Hapy Support Assistant"
  },
  "messages": [
    {
      "id": "clxmsg001",
      "role": "USER",
      "content": "How much does your software development service cost?",
      "responseTime": null,
      "createdAt": "2026-08-10T12:10:00.000Z"
    },
    {
      "id": "clxmsg002",
      "role": "ASSISTANT",
      "content": "Our software development pricing depends on project scope...",
      "responseTime": 1820,
      "createdAt": "2026-08-10T12:10:02.000Z"
    }
  ]
}
```

---

## Analytics

All analytics routes require auth and aggregate data across the user's agents.

Optional query param on all: `agentId` (string) — filter to one agent.

### `GET /analytics/overview`

Dashboard KPI cards.

**Response 200**

```json
{
  "totalConversations": 128,
  "totalMessages": 512,
  "averageResponseTimeMs": 1800,
  "averageConversationLength": 4.0,
  "positiveSentimentPercent": 72.5,
  "negativeSentimentPercent": 8.2,
  "mostCommonTopic": "TECHNICAL"
}
```

---

### `GET /analytics/topics`

Topic/category distribution.

**Response 200**

```json
{
  "distribution": [
    { "category": "TECHNICAL", "count": 45, "percent": 35.2 },
    { "category": "SUPPORT", "count": 32, "percent": 25.0 },
    { "category": "PRICING", "count": 28, "percent": 21.9 },
    { "category": "SALES", "count": 15, "percent": 11.7 },
    { "category": "GENERAL", "count": 8, "percent": 6.2 }
  ],
  "total": 128
}
```

---

### `GET /analytics/sentiment`

Sentiment distribution.

**Response 200**

```json
{
  "distribution": [
    { "sentiment": "POSITIVE", "count": 93, "percent": 72.5 },
    { "sentiment": "NEUTRAL", "count": 25, "percent": 19.5 },
    { "sentiment": "NEGATIVE", "count": 10, "percent": 7.8 }
  ],
  "total": 128
}
```

---

### `GET /analytics/trends`

Conversations over time for charts.

**Query params**

| Param | Type | Description |
|-------|------|-------------|
| period | string | `day` \| `week` \| `month` (default `day`) |
| days | number | lookback window (default 7) |

**Response 200**

```json
{
  "period": "day",
  "points": [
    { "date": "2026-08-04", "conversations": 12, "messages": 48 },
    { "date": "2026-08-05", "conversations": 18, "messages": 72 },
    { "date": "2026-08-06", "conversations": 15, "messages": 60 },
    { "date": "2026-08-07", "conversations": 22, "messages": 88 },
    { "date": "2026-08-08", "conversations": 19, "messages": 76 },
    { "date": "2026-08-09", "conversations": 25, "messages": 100 },
    { "date": "2026-08-10", "conversations": 17, "messages": 68 }
  ]
}
```

---

## Business insights (derived client-side or future endpoint)

The frontend dashboard may compose insights from analytics responses. Example copy:

- **Support:** "Technical questions represent the largest category of conversations."
- **Sentiment:** "72% of analyzed conversations have positive sentiment."
- **Performance:** "Average AI response time is 1.8 seconds."

A dedicated `GET /analytics/insights` endpoint may be added in Week 2.

---

## Enums reference

| Enum | Values |
|------|--------|
| MessageRole | `USER`, `ASSISTANT` |
| Sentiment | `POSITIVE`, `NEUTRAL`, `NEGATIVE` |
| Category | `SUPPORT`, `SALES`, `PRICING`, `TECHNICAL`, `GENERAL` |
| KnowledgeType | `PDF`, `TEXT` |
