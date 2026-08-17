# Phase 2 Frontend — Dashboard + AI Agent Management

**Scope now:** UI only (JavaScript / JSX)  
**Depends on:** [`PHASE2_BACKEND_PLAN.md`](PHASE2_BACKEND_PLAN.md) APIs tested first  
**App:** `AI-Customer-Support-Agent`  
**Visual language:** existing Hapy teal + landing/auth patterns (not a new theme)

---

## Goal

After login, user lands on a real **Dashboard** overview and can fully **manage AI agents**.

---

## User stories

1. Login / register → redirect **`/dashboard`** (already via `proxy.js`)  
2. See KPI cards from `GET /api/analytics/overview`  
3. Use shortcuts: **Create Agent**, **Open Chat**, **View Analytics**  
4. Create agent with Name, Description, System Prompt, Welcome Message  
5. List, view, edit, delete own agents  

---

## Routes (App Router)

| Path | Page |
|------|------|
| `/dashboard` | Overview metrics + shortcuts (replace current placeholder) |
| `/agents` | List agents |
| `/agents/new` | Create agent form |
| `/agents/[id]` | View agent detail |
| `/agents/[id]/edit` | Edit agent form |

All under existing `app/(app)/` layout (header + auth).

### Shortcuts (Phase 2 behavior)

| Shortcut | Goes to | Note |
|----------|---------|------|
| Create Agent | `/agents/new` | Real |
| Open Chat | `/agents` (or first agent later) | Chat UI = Phase 4 — for now link to agents list with short hint, **or** stub `/chat` “Coming soon” |
| View Analytics | stub `/analytics` | Full charts later — page can say “Coming soon” + still show overview KPIs already on dashboard |

**Recommendation:** stub pages `/chat` and `/analytics` so shortcuts never 404.

---

## 1. Dashboard UI

### Required metrics (cards)

| Card | API field | Empty state |
|------|-----------|-------------|
| Total Conversations | `totalConversations` | `0` |
| Total Messages | `totalMessages` | `0` |
| Average Response Time | `averageResponseTimeMs` | `0` → show `—` or `0s` |
| Positive Sentiment % | `positiveSentimentPercent` | `0%` |
| Negative Sentiment % | `negativeSentimentPercent` | `0%` |
| Most Common Topic | `mostCommonTopic` | `—` / `No data` |

### Also show

- Welcome line with user name (keep)  
- Shortcut buttons / links row  
- Optional: recent agents count (`GET /api/agents` length) — nice-to-have  

### States

- Loading skeletons for metric cards  
- Error toast / inline if overview fails  
- After auth, data fetch with `credentials: "include"` via existing `api-client`

---

## 2. AI Agent Management UI

### Example defaults (placeholders in form)

- **Name:** `Hapy Support Assistant`  
- **Description:** `AI assistant for answering Hapy customer questions.`  
- **Welcome Message:** `Hi! How can I help you today?`  
- **System Prompt:** short starter text (e.g. “You are a helpful customer support agent for Hapy…”)

### List (`/agents`)

- Empty state: “No agents yet” + CTA Create  
- Cards/rows: name, description snippet, created date  
- Actions: View, Edit, Delete, (disabled/hint: Knowledge, Chat — later)  
- Loading + error  

### Create (`/agents/new`)

Fields:

| Field | Required |
|-------|----------|
| Name | Yes |
| Description | No |
| System Prompt | Yes |
| Welcome Message | Yes |

Client validation mirrors Zod; on success → `/agents/[id]` or `/agents`.

### View (`/agents/[id]`)

Read-only fields + Edit / Delete / Back to list.

### Edit (`/agents/[id]/edit`)

Same form as create, prefilled; PUT on save.

### Delete

shadcn **Dialog** confirm → DELETE → redirect `/agents`.

---

## 3. Shell / nav updates

Update `AppHeader` (and optional simple sidebar later):

- Dashboard  
- Agents  
- (Chat / Analytics stubs optional in nav)

Keep logout as-is.

Protect new routes in `proxy.js` matcher (same cookie rule as `/dashboard`):

```
/dashboard, /agents, /agents/:path*, /chat, /analytics
```

Do **not** add `middleware.js` — Next.js 16 uses **Proxy** only.

---

## 4. Files to create / update

```
# API client helpers
lib/api/agents.js              # list/create/get/update/delete
lib/api/analytics.js           # getOverview()

# Dashboard
components/dashboard/MetricCard.jsx
components/dashboard/DashboardShortcuts.jsx
app/(app)/dashboard/page.jsx   # rewrite

# Agents
components/agents/AgentForm.jsx
components/agents/AgentList.jsx
components/agents/AgentCard.jsx
components/agents/DeleteAgentDialog.jsx
app/(app)/agents/page.jsx
app/(app)/agents/new/page.jsx
app/(app)/agents/[id]/page.jsx
app/(app)/agents/[id]/edit/page.jsx

# Stubs
app/(app)/chat/page.jsx
app/(app)/analytics/page.jsx

# Shell
components/layout/AppHeader.jsx  # nav links
proxy.js                         # protect new paths (NOT middleware.js)
```

---

## 5. Implementation order (after backend DONE)

1. Proxy matcher + header nav  
2. `lib/api/agents` + `lib/api/analytics`  
3. Agents list + create (happy path)  
4. View + edit + delete  
5. Dashboard metrics + shortcuts  
6. Chat / Analytics stub pages  
7. Browser E2E: login → dashboard → create agent → edit → delete  

---

## 6. Design notes (keep consistent)

- Use existing CSS vars (`--color-primary`, `--color-bg`, etc.)  
- Metric cards: simple grid, not heavy dashboard chrome  
- Forms: same field styles as auth where practical  
- Mobile: stacked metric grid, full-width forms  

---

## Phase 2 Frontend checklist

- [x] Dashboard shows all 6 metrics (zeros OK)  
- [x] Shortcuts work (Create real; Chat/Analytics stub OK)  
- [x] Create / list / view / edit / delete agents  
- [x] Empty, loading, error states  
- [x] `proxy.js` protects agent routes  
- [x] Full flow tested in browser  
- [x] **PHASE 2 FRONTEND DONE**  

---

## Out of scope

- Knowledge upload UI (Phase 3)  
- Live chat with OpenAI (Phase 4)  
- Charts / trends / insights pages (later analytics phase)  
- Changing auth  
- Mock/fake metrics that disagree with the overview API
