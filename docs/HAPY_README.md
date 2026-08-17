# Hapy — AI Customer Support & Customer Insights

**MVP Internship Project · 2–3 Weeks · 2 Developers**

> **Alternative plan (1 person, Next.js fullstack):**  
> Agar aap **akelay** Next.js (UI + API ek hi project) mein banana chahte ho, yeh plan use karo — purana 2-dev plan yahan hi rehta hai:  
> → [`NEXTJS_FULLSTACK_PLAN.md`](NEXTJS_FULLSTACK_PLAN.md)

---

## Team Split

| Person | Role | Plan document |
|--------|------|---------------|
| **Sami** | Backend (API, DB, AI, Analytics) | [`docs/BACKEND_README.md`](docs/BACKEND_README.md) |
| **Ahmad** | Frontend (React UI, Charts) | [`docs/FRONTEND_README.md`](docs/FRONTEND_README.md) |

**Important:** Dono apne **alag systems** par kaam karenge, lekin **ek hi GitHub repo** share karenge aur same **API contract** follow karenge.

---

## What We Are Building

A web app where a business user can:

1. Register / Login
2. Create AI support agents
3. Add knowledge (PDF + text/FAQ)
4. Chat with the AI
5. Store all conversations in PostgreSQL (Neon)
6. See analytics — sentiment, topics, trends, business insights

---

## Tech Stack (JavaScript Only)

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite, Tailwind CSS 4, **shadcn/ui**, React Router, TanStack Query, Axios, Recharts |
| UI Reference | [Botpress](https://botpress.com/) — clean AI-agent product look |
| Styling | Global CSS variables (colors + fonts) + Tailwind |
| Backend | Node.js, Express, Prisma ORM |
| Database | **Neon PostgreSQL** |
| Auth | JWT + bcrypt |
| AI | OpenAI API (abstracted — easy to swap later) |
| Validation | Zod |
| Language | **JavaScript only** (`.js` / `.jsx` — no TypeScript) |

---

## Project Folder Structure

```
Hapy Ai support agent/
├── backend/              ← Sami builds this
├── frontend/             ← Ahmad builds this (separate machine)
├── docs/
│   ├── api-contract.md   ← Both must follow this
│   ├── BACKEND_README.md ← Sami's plan + phase checklists
│   ├── FRONTEND_README.md← Ahmad's plan + phase checklists
│   ├── data-pipeline.md  ← Created in Week 2
│   └── mocks/            ← Ahmad uses these until API is ready
└── HAPY_README.md        ← This file (project overview)
```

---

## How Sami & Ahmad Work Together (Phase by Phase)

Dono **ek sath** apne systems par kaam karte hain. Har phase ka flow yeh hai:

```
┌──────────────────────────────────────────────────────────────┐
│  1. PHASE START                                              │
│     Sami  → is phase ki API banata hai                       │
│     Ahmad → is phase ka UI banata hai (mocks se pehle)       │
├──────────────────────────────────────────────────────────────┤
│  2. SAMI TESTS API                                           │
│     Postman/curl se test → sab theek ho to Ahmad ko deta hai │
│     Message: "Phase X ready — ye endpoints use karo"         │
├──────────────────────────────────────────────────────────────┤
│  3. AHMAD INTEGRATES                                         │
│     Mocks hata kar real API connect karta hai                │
│     VITE_API_URL → Sami ka localhost IP ya live URL          │
├──────────────────────────────────────────────────────────────┤
│  4. DONO TOGETHER TEST                                       │
│     Screen share / call → full flow test                     │
│     Bugs fix → PR merge to develop                           │
├──────────────────────────────────────────────────────────────┤
│  5. MARK DONE                                                │
│     Sami  → BACKEND_README.md checklist mein [x]             │
│     Ahmad → FRONTEND_README.md checklist mein [x]            │
│     Phir next phase start                                    │
└──────────────────────────────────────────────────────────────┘
```

**Rule:** Jab tak current phase **dono ne together test** nahi kiya aur checklist mark nahi hui — next phase mat shuru karo.

---

## Setup (Both Laptops)

### Step 1 — Clone same repo

```bash
git clone <your-github-repo-url>
cd "Hapy Ai support agent"
git checkout develop
```

### Step 2 — Each person sets up only their part

| Sami (Backend) | Ahmad (Frontend) |
|----------------|------------------|
| `cd backend && npm install` | `cd frontend && npm install` |
| Create Neon DB + `backend/.env` | Create `frontend/.env` |
| Run `npm run dev` → port **4000** | Run `npm run dev` → port **5173** |

### Step 3 — Git branches

```
main              ← production-ready only
develop           ← integration branch
feature/auth      ← Sami
feature/auth-ui   ← Ahmad
feature/agents
feature/agents-ui
... etc
```

**Rule:** Every feature → Pull Request → other person reviews → merge to `develop`.

---

## Integration Options (Separate Machines)

### Option A — Same WiFi (local)

Ahmad `frontend/.env`:

```env
VITE_API_URL=http://<SAMI_LAPTOP_IP>:4000/api
```

Sami `backend/.env`:

```env
CORS_ORIGIN=http://<AHMAD_LAPTOP_IP>:5173,http://localhost:5173
```

### Option B — Deploy backend early (recommended after Phase 1)

```env
VITE_API_URL=https://your-api.onrender.com/api
```

### Option C — Mocks (jab API ready na ho)

Ahmad `docs/mocks/` use karega jab tak Sami na bole: **"Phase X API ready."**

---

## 2-Week Timeline

### Week 1 — Working AI Support App

| Phase | Days | Sami (Backend) | Ahmad (Frontend) | Together |
|-------|------|----------------|------------------|----------|
| **0 Setup** | Day 1 | Express + Prisma + Neon + health | Vite + React + Tailwind + shadcn + layout | Both apps run |
| **1 Auth** | Day 2–3 | Register, login, JWT | Login + Register pages | Login end-to-end |
| **2 Agents** | Day 4–5 | Agent CRUD API | Agent list + create/edit | Create agent in UI |
| **3 Knowledge** | Day 6–7 | PDF + text upload | Knowledge page | Upload PDF in UI |
| **4 Chat** | Day 8–10 | AI chat + save conversations | Chat interface | Full chat with AI |

**Week 1 goal:** Register → create agent → add knowledge → chat with AI.

### Week 2 — Insights

| Phase | Days | Sami (Backend) | Ahmad (Frontend) | Together |
|-------|------|----------------|------------------|----------|
| **5 Analytics** | Day 11–14 | Sentiment, topics, analytics APIs | Dashboard + charts + insights | Dashboard shows real data |
| **6 Deploy** | Day 15+ | Deploy API + migrations | Deploy to Vercel | Production demo |

**Week 2 goal:** Analytics dashboard with sentiment, topics, trends, business insights.

### Optional Week 3

Pick **2–3 only**: better RAG, more tests, CI/CD, UI polish, rate limiting.

---

## Master Phase Checklist (Mark Together)

Har phase complete hone ke baad yahan bhi tick karo. Detailed checklists apne README mein hain.

| Phase | Sami API done | Ahmad UI done | Integrated & tested | Marked in READMEs |
|-------|---------------|---------------|---------------------|-------------------|
| 0 Setup | [ ] | [ ] | [ ] | [ ] |
| 1 Auth | [ ] | [ ] | [ ] | [ ] |
| 2 Agents | [ ] | [ ] | [ ] | [ ] |
| 3 Knowledge | [ ] | [ ] | [ ] | [ ] |
| 4 Chat | [ ] | [ ] | [ ] | [ ] |
| 5 Analytics | [ ] | [ ] | [ ] | [ ] |
| 6 Deploy | [ ] | [ ] | [ ] | [ ] |

---

## Shared Documents

| File | Purpose |
|------|---------|
| [`docs/api-contract.md`](docs/api-contract.md) | Exact API request/response shapes |
| [`docs/mocks/`](docs/mocks/) | Sample JSON for Ahmad |
| [`docs/BACKEND_README.md`](docs/BACKEND_README.md) | Sami's full plan + checklists |
| [`docs/FRONTEND_README.md`](docs/FRONTEND_README.md) | Ahmad's full plan + checklists |

**Do not change API contract** without telling the other person.

---

## Database (Neon PostgreSQL)

**Only Sami needs Neon access.**

```
User
 └── Agent
       ├── KnowledgeDocument
       └── Conversation
               └── Message
```

Enums: `MessageRole`, `Sentiment`, `Category`, `KnowledgeType`

---

## Environment Variables

### Backend (`backend/.env`) — Sami only

```env
PORT=4000
NODE_ENV=development
DATABASE_URL=postgresql://...       # Neon pooled
DIRECT_URL=postgresql://...         # Neon direct
JWT_SECRET=your-secret-min-16-chars
JWT_EXPIRES_IN=7d
OPENAI_API_KEY=sk-...
CORS_ORIGIN=http://localhost:5173
```

### Frontend (`frontend/.env`) — Ahmad only

```env
VITE_API_URL=http://localhost:4000/api
```

> Never commit `.env`. Use `.env.example` in each folder.

---

## API Quick Reference

Base path: `/api`

| Area | Endpoints |
|------|-----------|
| Health | `GET /health` |
| Auth | `POST /auth/register`, `/login`, `/logout` |
| Agents | CRUD `/agents`, `/agents/:id` |
| Knowledge | `/agents/:id/knowledge`, `DELETE /knowledge/:id` |
| Chat | `POST /agents/:id/chat` |
| Conversations | `GET /conversations`, `/conversations/:id` |
| Analytics | `/analytics/overview`, `/topics`, `/sentiment`, `/trends` |

Full details: [`docs/api-contract.md`](docs/api-contract.md)

---

## Definition of Done (Full MVP)

- [ ] User can register and login
- [ ] User can create an AI agent
- [ ] User can add knowledge (PDF + text)
- [ ] User can chat with the AI
- [ ] Conversations stored in Neon PostgreSQL
- [ ] Sentiment + topic classification works
- [ ] Analytics dashboard shows KPIs and charts
- [ ] Business insights displayed
- [ ] App is responsive
- [ ] UI inspired by Botpress (clean, modern)
- [ ] Deployed (Frontend → Vercel, Backend → Render, DB → Neon)
- [ ] README complete
- [ ] Both reviewed each other's PRs
- [ ] Final demo ready

---

## Where to Start

| You are… | Read this first |
|----------|-----------------|
| **Sami (Backend)** | [`docs/BACKEND_README.md`](docs/BACKEND_README.md) → Phase 0 |
| **Ahmad (Frontend)** | [`docs/FRONTEND_README.md`](docs/FRONTEND_README.md) → Phase 0 |

---

## License

Internal internship project — Hapy.
