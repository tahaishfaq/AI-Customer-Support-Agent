# Hapy Frontend Plan

**Owner:** Ahmad (Frontend Developer)  
**Pair:** Sami (Backend)  
**Stack:** React 19 · Vite · Tailwind CSS 4 · **shadcn/ui** · React Router · TanStack Query · Axios · Recharts  
**Language:** JavaScript only (`.jsx` files)

**Dev URL:** `http://localhost:5173`  
**API URL:** `http://localhost:4000/api` (or Sami's IP / deployed URL)

**UI Reference:** [Botpress](https://botpress.com/) — use this as visual inspiration (clean AI-agent product: clear layout, calm colors, strong hierarchy, modern chat/dashboard feel). Do **not** copy their brand/logo; match the **feel** (professional, spacious, product-focused).

---

## Your Job (Simple Summary)

You build the **web UI**:

1. Login + Register  
2. Dashboard with KPI cards  
3. Agent management (create, edit, delete, list)  
4. Knowledge page (PDF + text/FAQ)  
5. Chat interface  
6. Analytics page with charts + business insights  

Sami builds the API. Dono **`docs/api-contract.md`** follow karte ho.

---

## How You Work With Sami (Every Phase)

```
1. Tum UI banao (mocks se pehle — docs/mocks/)
2. Sami API banata hai + khud test karta hai
3. Sami message: "Phase X ready — ye endpoints use karo"
4. Tum mocks hata kar REAL API integrate karo
5. Dono mil kar test karo (call / screen share)
6. Bugs fix → PR merge
7. Is README mein checklist [x] mark karo
8. Tabhi next phase start
```

**Tip:** Har page par loading, empty, error states zaroor banao.

---

## Phase Progress Checklist (Mark Here)

Jab phase complete + Sami ke sath integrate + test ho jaye → tick karo.

| Phase | UI built (mocks ok) | Integrated with Sami API | Tested together | DONE |
|-------|---------------------|--------------------------|-----------------|------|
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
3. Open [Botpress](https://botpress.com/) — UI inspiration  
4. Clone repo on **your laptop**  
5. Use `docs/mocks/` until Sami says API is ready  
6. Do **not** wait for backend — UI pehle banao  

---

# Design System (Required)

## UI Reference — Botpress

Reference site: **https://botpress.com/**

Take inspiration for:

- Clean product landing / dashboard feel  
- Clear typography hierarchy (strong headings, short supporting text)  
- Calm neutral backgrounds + one clear accent  
- Spacious layout (not cramped)  
- Modern chat-style messaging area  
- Simple sidebar navigation for the app shell  

Avoid: purple glow clichés, heavy shadows, emoji clutter, random card grids in the hero.

---

## Global CSS — Colors & Fonts

Create **`frontend/src/index.css`** (global styles). Define colors and fonts here so the whole app stays consistent.

Example structure (adjust to match Botpress-inspired look):

```css
@import "tailwindcss";

/* Google fonts — pick 1 display + 1 body (not Inter/Roboto default stack) */
@import url("https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Instrument+Sans:wght@400;500;600;700&display=swap");

:root {
  /* Brand / accent */
  --color-primary: #0f766e;        /* teal accent — calm product feel */
  --color-primary-hover: #0d9488;
  --color-primary-foreground: #ffffff;

  /* Neutrals */
  --color-bg: #f8fafc;
  --color-surface: #ffffff;
  --color-border: #e2e8f0;
  --color-muted: #64748b;
  --color-text: #0f172a;
  --color-text-secondary: #475569;

  /* Status */
  --color-success: #16a34a;
  --color-warning: #d97706;
  --color-danger: #dc2626;
  --color-info: #0284c7;

  /* Charts (analytics) */
  --color-chart-1: #0f766e;
  --color-chart-2: #0284c7;
  --color-chart-3: #d97706;
  --color-chart-4: #7c3aed;
  --color-chart-5: #dc2626;

  /* Typography */
  --font-sans: "Instrument Sans", system-ui, sans-serif;
  --font-display: "DM Sans", system-ui, sans-serif;

  /* Spacing / radius */
  --radius: 0.5rem;
}

html, body, #root {
  font-family: var(--font-sans);
  background: var(--color-bg);
  color: var(--color-text);
  min-height: 100%;
}

h1, h2, h3 {
  font-family: var(--font-display);
}
```

**Rules:**

- All colors come from CSS variables (no random hardcoded hex in components)  
- Use Tailwind + CSS vars together (e.g. `bg-[var(--color-surface)]`)  
- Keep shadcn theme tokens aligned with these variables  

---

## shadcn/ui Components (Required)

Use **shadcn/ui** for reusable UI pieces (buttons, inputs, dialogs, cards, etc.).

### Setup (Phase 0)

```bash
cd frontend
npx shadcn@latest init
```

Then add components as needed:

```bash
npx shadcn@latest add button input label card dialog textarea
npx shadcn@latest add dropdown-menu select table badge separator
npx shadcn@latest add avatar skeleton toast sonner sheet sidebar
```

### Where components live

```
frontend/src/components/ui/   ← shadcn components (Button, Input, Card, ...)
```

### Usage rule

- Prefer shadcn components over custom buttons/inputs  
- Custom layout components (`AppShell`, page sections) can wrap shadcn UI  
- Keep styling consistent with global CSS variables  

---

# PHASE 0 — Project Setup (Day 1)

**Branch:** `feature/setup-ui`  
**Goal:** App runs with layout, routing, global CSS, shadcn.

### Steps

1. Create Vite React app:

```bash
npm create vite@latest frontend -- --template react
cd frontend
npm install
```

2. Install packages:

```bash
npm install react-router-dom @tanstack/react-query axios recharts lucide-react
npm install -D tailwindcss @tailwindcss/vite
```

3. Tailwind in `vite.config.js` + `@import "tailwindcss"` in CSS  
4. Write **global CSS** (`src/index.css`) — colors + fonts (see above)  
5. Init **shadcn/ui** and add base components  
6. Create folder structure + `AppShell` (sidebar inspired by Botpress product apps)  
7. Create `.env` + `.env.example`:

```env
VITE_API_URL=http://localhost:4000/api
```

If Sami is on another laptop (same WiFi):

```env
VITE_API_URL=http://192.168.x.x:4000/api
```

8. Run:

```bash
npm run dev
```

### Folder Structure

```
frontend/src/
├── api/
│   ├── client.js
│   ├── auth.api.js
│   ├── agents.api.js
│   ├── knowledge.api.js
│   ├── chat.api.js
│   ├── conversations.api.js
│   └── analytics.api.js
├── components/
│   ├── ui/                 ← shadcn components
│   └── layout/
│       ├── AppShell.jsx
│       └── Sidebar.jsx
├── pages/
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   ├── DashboardPage.jsx
│   ├── AgentsPage.jsx
│   ├── AgentFormPage.jsx
│   ├── KnowledgePage.jsx
│   ├── ChatPage.jsx
│   ├── AnalyticsPage.jsx
│   └── ConversationsPage.jsx
├── routes/
│   ├── AppRoutes.jsx
│   └── ProtectedRoute.jsx
├── context/
│   └── AuthContext.jsx
├── utils/
│   └── insights.js
├── App.jsx
├── main.jsx
└── index.css               ← GLOBAL colors + fonts
```

### Phase 0 Checklist — Mark When Done

- [ ] App loads at `http://localhost:5173`
- [ ] Tailwind works
- [ ] Global CSS has colors + fonts defined
- [ ] shadcn/ui initialized + base components added
- [ ] Basic layout / sidebar exists (Botpress-inspired)
- [ ] Routing skeleton exists
- [ ] `.env.example` committed
- [ ] Told Sami: "Frontend runs on 5173"
- [ ] Together: both apps run
- [ ] **PHASE 0 DONE** → mark table above

---

# PHASE 1 — Auth UI (Days 2–3)

**Branch:** `feature/auth-ui`  
**Goal:** Register, login, logout. Protected routes.

### Pages

| Page | Route | Fields |
|------|-------|--------|
| Login | `/login` | email, password |
| Register | `/register` | name, email, password, confirm password |

### Also Build

- `AuthContext.jsx` — user + token  
- JWT in `localStorage`  
- `ProtectedRoute.jsx`  
- Axios interceptor (`Authorization: Bearer <token>`)  
- Use shadcn `Button`, `Input`, `Label`, `Card`  

### Validation

- Name required  
- Valid email  
- Password min 8  
- Confirm must match  

### Mocks first

`docs/mocks/auth-login.json`, `auth-register.json`

### Phase 1 Checklist — Mark When Done

- [ ] Register page (loading + error + success)
- [ ] Login page (loading + error + success)
- [ ] Token saved in localStorage
- [ ] Protected routes redirect to `/login`
- [ ] Logout clears token
- [ ] Integrated with Sami Auth API
- [ ] Together: register + login end-to-end
- [ ] PR merged to `develop`
- [ ] **PHASE 1 DONE** → mark table above

---

# PHASE 2 — Agents UI (Days 4–5)

**Branch:** `feature/agents-ui`  
**Goal:** Create, list, edit, delete agents.

### Pages

| Page | Route |
|------|-------|
| Agents list | `/agents` |
| Create | `/agents/new` |
| Edit | `/agents/:id/edit` |

### Form fields

Name, Description, System Prompt, Welcome Message  

Use shadcn `Card`, `Dialog` (delete confirm), `Button`, `Textarea`.

### States

- Empty: "No agents yet..."  
- Loading: skeleton  
- Error + retry  
- Success toast  

### Phase 2 Checklist — Mark When Done

- [ ] List / create / edit / delete work
- [ ] All UI states (loading, empty, error, success)
- [ ] Links to Knowledge + Chat
- [ ] Integrated with Sami Agents API
- [ ] Together: CRUD in UI works
- [ ] PR merged to `develop`
- [ ] **PHASE 2 DONE** → mark table above

---

# PHASE 3 — Knowledge UI (Days 6–7)

**Branch:** `feature/knowledge-ui`  
**Goal:** Text/FAQ + PDF upload.

### Page

`/agents/:id/knowledge`

### Features

- List documents  
- Add text/FAQ form  
- PDF file picker + upload spinner  
- Delete with confirm dialog  

### Phase 3 Checklist — Mark When Done

- [ ] Text FAQ save works
- [ ] PDF upload with loading state
- [ ] Delete with confirmation
- [ ] Integrated with Sami Knowledge API
- [ ] Together: upload PDF + FAQ in UI
- [ ] PR merged to `develop`
- [ ] **PHASE 3 DONE** → mark table above

---

# PHASE 4 — Chat UI (Days 8–10)

**Branch:** `feature/chat-ui`  
**Goal:** Chat with AI (Botpress-like clean chat panel).

### Page

`/chat` or `/agents/:id/chat`

### Layout (Botpress-inspired)

```
┌─────────────────────────────────────────┐
│  Agent: [Dropdown]                      │
├─────────────────────────────────────────┤
│  AI welcome message                     │
│              User message (right)       │
│  AI reply (left)                        │
├─────────────────────────────────────────┤
│  [Type message...              ] [Send] │
└─────────────────────────────────────────┘
```

### Behavior

- Agent dropdown  
- Welcome message on new chat  
- Loading dots while AI responds  
- Error + retry  
- Keep `conversationId` in state for multi-turn  

### Phase 4 Checklist — Mark When Done

- [ ] Send message → AI reply shows
- [ ] Loading + error + retry
- [ ] Multi-turn conversation works
- [ ] Agent dropdown works
- [ ] Integrated with Sami Chat API
- [ ] Together: full AI chat flow
- [ ] PR merged to `develop`
- [ ] **PHASE 4 DONE** → mark table above (**Week 1 complete**)

---

# PHASE 5 — Dashboard + Analytics (Days 11–14)

**Branch:** `feature/analytics-ui`  
**Goal:** KPIs, charts, business insights.

### Dashboard (`/dashboard`)

KPI cards from `/api/analytics/overview` + shortcuts: Create Agent, Open Chat, View Analytics.

### Analytics (`/analytics`)

| Chart | API | Type |
|-------|-----|------|
| Conversation trend | `/analytics/trends` | Line |
| Topic distribution | `/analytics/topics` | Pie/Bar |
| Sentiment | `/analytics/sentiment` | Bar |

Business insights via `utils/insights.js` (2–3 human-readable lines).

Use chart colors from CSS variables (`--color-chart-*`).

### Phase 5 Checklist — Mark When Done

- [ ] Dashboard KPI cards
- [ ] Trend / topics / sentiment charts
- [ ] Business insights section
- [ ] Empty / loading / error states
- [ ] Integrated with Sami Analytics API
- [ ] Together: numbers match backend
- [ ] PR merged to `develop`
- [ ] **PHASE 5 DONE** → mark table above

---

# PHASE 6 — Deploy + Polish (Days 15+)

**Branch:** `feature/deploy-ui`

### Phase 6 Checklist — Mark When Done

- [ ] Responsive (sidebar → hamburger on mobile)
- [ ] All pages have loading / empty / error
- [ ] Success toasts on create/update/delete
- [ ] Global CSS + shadcn consistent across app
- [ ] UI still feels Botpress-inspired
- [ ] Deployed to Vercel
- [ ] `VITE_API_URL` = Sami production API
- [ ] Together: production smoke test
- [ ] **PHASE 6 DONE** → mark table above

---

## Routing Map

| Route | Protected | Page |
|-------|-----------|------|
| `/login` | No | LoginPage |
| `/register` | No | RegisterPage |
| `/dashboard` | Yes | DashboardPage |
| `/agents` | Yes | AgentsPage |
| `/agents/new` | Yes | AgentFormPage |
| `/agents/:id/edit` | Yes | AgentFormPage |
| `/agents/:id/knowledge` | Yes | KnowledgePage |
| `/chat` | Yes | ChatPage |
| `/agents/:id/chat` | Yes | ChatPage |
| `/analytics` | Yes | AnalyticsPage |
| `/conversations` | Yes | ConversationsPage |

---

## API Client Setup

```js
// api/client.js
import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default client;
```

---

## Mock Mode

While waiting for Sami:

```env
VITE_USE_MOCKS=true
```

Use JSON from `docs/mocks/`. Switch off when Sami says phase API is ready.

---

## Frontend Definition of Done

- [ ] Register, login, logout work
- [ ] Protected routes work
- [ ] Agent CRUD with all states
- [ ] Knowledge upload (text + PDF)
- [ ] Chat works with AI replies
- [ ] Dashboard KPIs + analytics charts
- [ ] Business insights shown
- [ ] Global CSS colors/fonts used everywhere
- [ ] shadcn/ui used for core components
- [ ] UI inspired by [Botpress](https://botpress.com/)
- [ ] Responsive on mobile
- [ ] Deployed on Vercel
- [ ] All phase checklists marked DONE

---

## Quick Commands

```bash
cd frontend
npm run dev
npm run build
npm run preview
npx shadcn@latest add <component>
```

---

## When Stuck

1. Check browser console + Network tab  
2. Compare response with `docs/api-contract.md`  
3. Try mocks — UI bug or API bug?  
4. Ask Sami to hit same endpoint in Postman  

**Build like a real product.**
