# Hapy Backend Plan

**Owner:** Sami (Backend Developer)  
**Pair:** Ahmad (Frontend)  
**Stack:** Node.js · Express · Prisma · Neon PostgreSQL · JWT · OpenAI  
**Language:** JavaScript only (`.js` files)

**Local API URL:** `http://localhost:4000/api`

---

## Your Job (Simple Summary)

You build the **REST API**:

1. Auth — register, login, logout  
2. Agents — create, read, update, delete  
3. Knowledge — upload PDF + add text/FAQ  
4. Chat — send message → AI reply → save to DB  
5. Analytics — sentiment, topics, trends, KPIs  

Ahmad builds the UI. Dono **`docs/api-contract.md`** follow karte ho.

---

## How You Work With Ahmad (Every Phase)

```
1. Tum API banao (is phase ke endpoints)
2. Postman / curl se KHUD test karo
3. Ahmad ko message: "Phase X ready — ye endpoints use karo"
4. Ahmad integrate kare
5. Dono mil kar test karo (call / screen share)
6. Bugs fix → PR merge
7. Is README mein checklist [x] mark karo
8. Tabhi next phase start
```

**Do not change API contract** without telling Ahmad first.

---

## Phase Progress Checklist (Mark Here)

Jab phase complete + Ahmad ke sath integrate + test ho jaye → tick karo.

| Phase | API built & tested | Given to Ahmad | Integrated & tested together | DONE |
|-------|--------------------|----------------|------------------------------|------|
| 0 Setup | [ ] | [ ] | [ ] | [ ] |
| 1 Auth | [ ] | [ ] | [ ] | [ ] |
| 2 Agents | [ ] | [ ] | [ ] | [ ] |
| 3 Knowledge | [ ] | [ ] | [ ] | [ ] |
| 4 Chat | [ ] | [ ] | [ ] | [ ] |
| 5 Analytics | [ ] | [ ] | [ ] | [ ] |
| 6 Deploy | [ ] | [ ] | [ ] | [ ] |

---

## Before You Start

1. Read [`HAPY_README.md`](../HAPY_README.md)  
2. Read [`docs/api-contract.md`](api-contract.md)  
3. Create Neon account → [console.neon.tech](https://console.neon.tech)  
4. Clone repo on **your laptop**  
5. Har phase ready hone par Ahmad ko batao  

---

# PHASE 0 — Project Setup (Day 1)

**Branch:** `feature/setup`  
**Goal:** Server runs, DB connected, health check works.

### Steps

1. Create Neon project `hapy-mvp` → copy `DATABASE_URL` (pooled) + `DIRECT_URL` (direct)
2. Create backend folder + `npm init -y`
3. Install packages:

```bash
npm install express cors dotenv bcrypt jsonwebtoken zod @prisma/client multer pdf-parse openai
npm install -D prisma nodemon jest supertest
```

4. Create `backend/.env` + `.env.example`:

```env
PORT=4000
NODE_ENV=development
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
JWT_SECRET=change-this-min-16-chars
JWT_EXPIRES_IN=7d
OPENAI_API_KEY=
CORS_ORIGIN=http://localhost:5173
```

5. Create Prisma schema (User → Agent → KnowledgeDocument / Conversation → Message)
6. Folder structure: `src/app.js`, `server.js`, `config/`, `middleware/`, `routes/`, `services/`, `validators/`, `utils/`
7. Health endpoint: `GET /api/health`
8. Run:

```bash
npx prisma generate
npx prisma migrate dev --name init
npm run dev
curl http://localhost:4000/api/health
```

### Phase 0 Checklist — Mark When Done

- [ ] Server runs on port 4000
- [ ] Neon DB connected
- [ ] Migrations applied
- [ ] Health check returns 200
- [ ] `.env.example` committed (not `.env`)
- [ ] Told Ahmad: "Backend is up — health works"
- [ ] Together: both apps run locally
- [ ] **PHASE 0 DONE** → mark table above

---

# PHASE 1 — Authentication (Days 2–3)

**Branch:** `feature/auth`  
**Goal:** Register, login, JWT. Protected routes work.

### Endpoints

| Method | Route | Auth? |
|--------|-------|-------|
| POST | `/api/auth/register` | No |
| POST | `/api/auth/login` | No |
| POST | `/api/auth/logout` | Yes |

### Rules

- bcrypt password hash  
- Password min 8 chars  
- Unique email → 409  
- Wrong login → 401  
- JWT expires 7 days  
- `confirmPassword` must match  

### Files

`middleware/auth.js` · `routes/auth.js` · `services/auth.service.js` · `validators/auth.schema.js`

### Phase 1 Checklist — Mark When Done

- [ ] Register works → 201 + token
- [ ] Duplicate email → 409
- [ ] Login works / wrong password → 401
- [ ] JWT middleware blocks unprotected access → 401
- [ ] Postman tests pass
- [ ] Told Ahmad: "Phase 1 Auth API ready"
- [ ] Together: register + login in UI works
- [ ] PR merged to `develop`
- [ ] **PHASE 1 DONE** → mark table above

---

# PHASE 2 — AI Agents (Days 4–5)

**Branch:** `feature/agents`  
**Goal:** CRUD for user's own agents.

### Endpoints

| Method | Route |
|--------|-------|
| GET | `/api/agents` |
| POST | `/api/agents` |
| GET | `/api/agents/:id` |
| PUT | `/api/agents/:id` |
| DELETE | `/api/agents/:id` |

### Fields

`name` (required), `description` (optional), `systemPrompt` (required), `welcomeMessage` (required)

### Rules

- All routes need JWT  
- Only own agents (else 403)  
- Delete cascades knowledge + conversations  

### Phase 2 Checklist — Mark When Done

- [ ] Full CRUD works in Postman
- [ ] Ownership check → 403 for wrong user
- [ ] Delete cascades related data
- [ ] Told Ahmad: "Phase 2 Agents API ready"
- [ ] Together: create / edit / delete agent in UI
- [ ] PR merged to `develop`
- [ ] **PHASE 2 DONE** → mark table above

---

# PHASE 3 — Knowledge Base (Days 6–7)

**Branch:** `feature/knowledge`  
**Goal:** Text/FAQ + PDF upload per agent.

### Endpoints

| Method | Route |
|--------|-------|
| GET | `/api/agents/:id/knowledge` |
| POST | `/api/agents/:id/knowledge` |
| DELETE | `/api/knowledge/:id` |

### Rules

- JSON for TEXT/FAQ  
- Multipart for PDF (`file` field, max 10MB)  
- Extract text with `pdf-parse` — store text only (not raw file)  
- Only agent owner can access  

### Phase 3 Checklist — Mark When Done

- [ ] Text knowledge saves
- [ ] PDF upload + text extraction works
- [ ] List + delete work
- [ ] Ownership checks work
- [ ] Told Ahmad: "Phase 3 Knowledge API ready"
- [ ] Together: upload PDF + FAQ in UI
- [ ] PR merged to `develop`
- [ ] **PHASE 3 DONE** → mark table above

---

# PHASE 4 — AI Chat + Conversations (Days 8–10)

**Branch:** `feature/chat`  
**Goal:** User message → AI reply → save everything.

### Endpoints

| Method | Route |
|--------|-------|
| POST | `/api/agents/:id/chat` |
| GET | `/api/conversations` |
| GET | `/api/conversations/:id` |

### Chat Flow

```
1. Validate + ownership
2. Create conversation if needed
3. Save USER message
4. Load systemPrompt + all knowledge (simple concat — no vector DB)
5. Load recent history
6. Call OpenAI
7. Save ASSISTANT message + responseTime (ms)
8. Classify category + sentiment
9. Update conversation
10. Return reply
```

Categories: `SUPPORT` | `SALES` | `PRICING` | `TECHNICAL` | `GENERAL`  
Sentiment: `POSITIVE` | `NEUTRAL` | `NEGATIVE`

Abstract AI in `services/ai/llm.provider.js`.

### Phase 4 Checklist — Mark When Done

- [ ] Chat returns real AI response
- [ ] Messages saved with role + responseTime
- [ ] Conversations list + detail work
- [ ] Category + sentiment stored
- [ ] Rate limit on `/chat` (optional: 20 req/min)
- [ ] Told Ahmad: "Phase 4 Chat API ready"
- [ ] Together: full chat flow in UI
- [ ] PR merged to `develop`
- [ ] **PHASE 4 DONE** → mark table above (**Week 1 complete**)

---

# PHASE 5 — Analytics + Data Pipeline (Days 11–14)

**Branch:** `feature/analytics`  
**Goal:** Dashboard gets real numbers.

### Endpoints

| Method | Route |
|--------|-------|
| GET | `/api/analytics/overview` |
| GET | `/api/analytics/topics` |
| GET | `/api/analytics/sentiment` |
| GET | `/api/analytics/trends` |

Optional: `?agentId=`

Also write `docs/data-pipeline.md`.

### Phase 5 Checklist — Mark When Done

- [ ] Overview KPIs correct
- [ ] Topics / sentiment / trends correct
- [ ] After 5+ test chats, numbers accurate
- [ ] `docs/data-pipeline.md` written
- [ ] Told Ahmad: "Phase 5 Analytics API ready"
- [ ] Together: dashboard + charts show real data
- [ ] PR merged to `develop`
- [ ] **PHASE 5 DONE** → mark table above

---

# PHASE 6 — Deploy + Polish (Days 15+)

**Branch:** `feature/deploy`

### Phase 6 Checklist — Mark When Done

- [ ] Rate limiting on `/chat`
- [ ] Tests: auth, agents, chat, analytics
- [ ] Deployed to Render / Railway
- [ ] Env vars set on host
- [ ] `npx prisma migrate deploy` on production Neon
- [ ] Production URL shared with Ahmad
- [ ] CORS updated with Vercel URL
- [ ] Together: production smoke test
- [ ] **PHASE 6 DONE** → mark table above

---

## Error Format (All Endpoints)

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
| 401 | Missing / invalid token |
| 403 | Not your resource |
| 404 | Not found |
| 409 | Duplicate email |
| 500 | Server error |

---

## Backend Definition of Done

- [ ] All endpoints match `docs/api-contract.md`
- [ ] Passwords hashed, JWT on protected routes
- [ ] Users only access their own data
- [ ] Chat saves messages with responseTime
- [ ] Sentiment + category on conversations
- [ ] Analytics calculations correct
- [ ] Critical paths have tests
- [ ] Deployed with secure env vars
- [ ] `data-pipeline.md` documented
- [ ] All phase checklists marked DONE

---

## Quick Commands

```bash
cd backend
npm run dev
npx prisma studio
npx prisma migrate dev --name <name>
npm test
curl http://localhost:4000/api/health
```

---

## When Stuck

1. Read the error  
2. Check Neon + `.env`  
3. Test with curl before blaming frontend  
4. Share error + what you tried with Ahmad  

**Build like a real product.**
