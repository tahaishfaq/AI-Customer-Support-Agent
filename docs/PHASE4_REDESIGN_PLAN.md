# Phase 4 — Botpress-like Redesign (Hapy brand)

**Scope:** UI / layout redesign only (no new product APIs, no new features)  
**When:** After Phase 3 (Knowledge) — before Chat E2E (Phase 5)  
**App:** `AI-Customer-Support-Agent`  
**Brand (KEEP):** `app/globals.css` tokens  
**Requirements:** *Hapy — AI Customer Support & Customer Insights* SRD v1.0  
**Visual refs:** Botpress Cloud screenshots (Home, Bot Overview, Analytics, Integrations Hub)  
**Canonical list:** [`NEXTJS_FULLSTACK_PLAN.md`](NEXTJS_FULLSTACK_PLAN.md)

> Chat API docs still named `PHASE4_BACKEND_PLAN.md` / `PHASE4_FRONTEND_PLAN.md` = **Phase 5**. This file = **Phase 4 Redesign**.

---

## Goal

Make the logged-in app **feel like Botpress Cloud** (sidebar product, cards, overview, analytics grid) while:

- Using **Hapy teal + Instrument Sans / DM Sans**
- Covering **every SRD screen** that already exists (Dashboard, Agents, Knowledge, Chat, Conversations, Analytics stub)
- **Not** copying Botpress dark theme, billing, integrations marketplace, or flow canvas

**Exit:** One consistent product shell. User journey from the SRD is visible in the UI. Analytics page is **layout-ready** for Phase 8 charts (no fake data).

---

## 1. Sources of truth

### 1.1 SRD — screens we must redesign (required)

| SRD section | Screen | Phase 4 work |
|-------------|--------|----------------|
| §6 Dashboard | `/dashboard` | Workspace home: KPIs + shortcuts + agent cards |
| §7 Agent management | `/agents`, `/agents/new`, `/agents/[id]`, edit | List + create CTA + agent header |
| §8 Knowledge | `/agents/[id]/knowledge` | Toolbar + denser list (keep PDF/Open/Preview) |
| §9 Chat | `/chat` | Full-height emulator (agent, history, input, loading, error) |
| §10 Conversations | `/conversations`, `/conversations/[id]` | Inbox list + transcript |
| §15–16 Analytics | `/analytics` | **Layout only** (KPI slots, trend, topics, sentiment, insights empty states) |
| §20 Frontend | All app pages | Loading / empty / error / success; responsive |

### 1.2 SRD — do **not** add in Phase 4

From SRD §29 Out of Scope + Botpress extras we will **not** clone:

- Billing, usage dollars, “Pay-as-you-go”, AI Spend tracker  
- Integrations Hub / WhatsApp / Slack / Discord  
- Multi-workspace, teams, RBAC  
- Human Handoff, Inspect logs, Always Alive  
- Flow canvas, website crawler, vector DB UI  

Those Botpress screens are **layout inspiration only**.

### 1.3 Botpress screenshots → Hapy mapping

| Botpress screenshot | Take (structure) | Drop | Hapy equivalent |
|---------------------|------------------|------|-----------------|
| **Home / workspace** | Left sidebar, breadcrumbs, search, **+ Create** CTA, bot **card** with 2 stats, right rail | Billing, AI Spend, Integrations, plan badge | `/dashboard` |
| **Bot Overview** | Grouped sidebar, bot **hero** (preview + name + status), KPI row, date range, chart well, right cards | Sleep/Always Alive, email verify banner, LLM spend | `/agents/[id]` overview (pre-Phase 6 tabs) |
| **Analytics** | Card grid, time range, User/Workspace toggle → skip toggle, chart cards, empty “No data” | Edit source / kebab menus | `/analytics` |
| **Integrations Hub** | Search + filter chips + **card grid** | Marketplace, install icons, featured Discord banner | Reuse card-grid pattern for **Agents list** only |

---

## 2. Brand rules (Hapy, not Botpress colors)

Keep existing tokens. Do **not** switch to Botpress black/blue/purple.

| Token | Value | Use |
|-------|--------|-----|
| `--color-primary` | `#0b5f58` | Primary buttons, active nav, user bubbles |
| `--color-primary-hover` | `#0f766e` | Hover |
| `--color-bg` | `#f8fafc` | App canvas |
| `--color-surface` | `#ffffff` | Sidebar, cards |
| `--color-border` | `#e2e8f0` | Dividers, card edges |
| `--color-text` | `#0f172a` | Titles |
| `--color-text-secondary` / `--color-muted` | slate | Meta |
| `--font-sans` | Instrument Sans | Body, nav, tables |
| `--font-display` | DM Sans | Page titles |

**From Botpress, copy structure not paint:**

- ~240px left sidebar, grouped nav, icon + label  
- Thin top bar: breadcrumbs left, user right  
- Cards: 8–12px radius, **1px border**, almost no shadow  
- Dense padding, airy gutters  
- Active nav = teal-tinted surface (`--sidebar-accent` / `#f0fdfa`), not a fat pill in the page center  

Optional CSS only:

```
--sidebar-width: 240px;
--app-topbar-height: 48px;
```

**No dark-mode Botpress clone** in this phase.

---

## 3. Target IA (information architecture)

Botpress groups: Overview / Monitor / Knowledge / Webchat / Settings.  
Hapy SRD groups (MVP only):

```
Hapy
├── Home              → /dashboard
├── Monitor
│   ├── Chat          → /chat
│   ├── Conversations → /conversations
│   └── Analytics     → /analytics
├── Agents            → /agents
│     └── [agent]
│           Overview / Knowledge / Edit   (tabs come in Phase 6)
└── (footer) User name + Log out
```

When an **agent is open**, sidebar can highlight Agents and show a compact agent name in breadcrumbs:

`Hapy › Agents › Hapy Support Assistant › Knowledge`

---

## 4. Layout chrome (all authenticated pages)

```
┌──────────────┬─────────────────────────────────────────────┐
│ Hapy         │  Home / Agents / Agent name     [avatar] [Log out]
│ Workspace    │─────────────────────────────────────────────│
│              │  Page title                    [primary CTA]
│ Home         │                                             │
│ Agents       │  Main content (cards / table / chat)        │
│ ── Monitor   │                                             │
│ Chat         │                          [optional right rail]
│ Conversations│                                             │
│ Analytics    │                                             │
│──────────────│                                             │
│ Sami · Log out                                             │
└──────────────┴─────────────────────────────────────────────┘
```

### Files

```
components/layout/AppShell.jsx       # sidebar + topbar + main
components/layout/AppSidebar.jsx     # grouped nav
components/layout/AppTopbar.jsx      # breadcrumbs + user
components/layout/PageHeader.jsx     # title + subtitle + actions
components/layout/EmptyState.jsx     # SRD empty copy
app/(app)/layout.jsx                 # wrap with AppShell; remove gradient hero chrome
```

`AppHeader.jsx` → replace or slim into Topbar. Centered top nav **goes away**.

---

## 5. Sub-phases (implement in this order)

Do **not** start Phase 5 until 4.1–4.6 checklists are done.

---

### Phase 4.1 — App shell

**Why:** Every Botpress screenshot starts with sidebar + breadcrumbs.

**Work**

1. `AppSidebar` — Hapy wordmark (teal), grouped links, active state  
2. `AppTopbar` — breadcrumbs, user initials, Log out  
3. Wire `app/(app)/layout.jsx`  
4. Mobile: hamburger → drawer (SRD §20 responsive)

**Nav**

| Group | Item | Href |
|-------|------|------|
| — | Home | `/dashboard` |
| — | Agents | `/agents` |
| Monitor | Chat | `/chat` |
| Monitor | Conversations | `/conversations` |
| Monitor | Analytics | `/analytics` |

**Done when**

- [x] All `(app)` routes use sidebar + topbar  
- [x] Active item matches pathname  
- [x] Mobile drawer works  
- [x] No centered top nav  

---

### Phase 4.2 — Home / Dashboard (SRD §6 + Botpress Home)

**Why:** SRD landing after login. Botpress Home = workspace header + Create + cards + right rail.

**Layout (light Hapy)**

1. **Workspace header** — “Hapy workspace” / user name, subtitle, **+ New agent** (primary teal)  
2. **KPI row** (SRD required): Total Conversations, Total Messages, Avg Response Time, Positive %, Negative %, Most Common Topic  
3. **Shortcuts** as compact text links or small tiles: Create Agent · Open Chat · View Analytics  
4. **Agents strip** — Botpress-style **agent cards**: name, “Ready”, 2 stats (e.g. conversations / messages) — data from existing overview/list APIs  
5. **Right rail (optional if space):** “Recent conversations” list (existing API) — **not** AI Spend / Bots quota  

Drop the large marketing “Welcome back” hero.

**Empty (SRD §20)**

- No agents: “Create an agent to get started.” + New agent  
- KPIs zero: show `0` / `—` like Botpress “No change”, not a crash  

**Done when**

- [x] Dashboard matches SRD metrics + shortcuts  
- [x] Looks like Botpress Home (cards + CTA), Hapy colors  
- [x] Loading skeletons for KPIs + cards  

---

### Phase 4.3 — Agents list + create/edit (SRD §7 + Botpress card grid)

**Why:** SRD agent CRUD. Botpress Home/Integrations = search + card grid.

**Agents list `/agents`**

- PageHeader: “Agents” + **+ New agent**  
- Search input (client filter by name) — like Botpress search bar  
- Grid of agent cards: monogram, name, description clamp, created date, actions: Open · Knowledge · Chat · Edit · Delete  
- Empty: “No agents yet.”  

**Create / Edit** — same form fields (name, description, system prompt, welcome). Put form in a **surface card** inside the shell (not a floating marketing panel).

**Done when**

- [ ] List feels like Botpress bot/integration cards  
- [ ] All SRD operations still work  
- [ ] Delete confirm unchanged  

---

### Phase 4.4 — Agent overview + Knowledge (SRD §7–8 + Botpress Bot Overview)

**Why:** Botpress Overview screenshot is the agent “home”: hero + KPIs + chart well.

**`/agents/[id]` (this phase, before Studio tabs)**

Hero card:

- Left: small chat-preview graphic or monogram (teal, not Botpress illustration clone)  
- Right: agent name, description, created  
- Actions: Chat · Knowledge · Edit · Delete  
- Status chip: “Active” (green dot) — no Always Alive  

Below hero (if overview API has data): 3 compact KPIs — Conversations, Messages, Avg response — or hide until Phase 8.

Do **not** build date-range charts here (Phase 8). Leave a **placeholder well** only if it doesn’t look broken; otherwise skip the empty chart.

**Knowledge `/agents/[id]/knowledge`**

- Breadcrumb: Agents › {name} › Knowledge  
- Toolbar: Add Text / FAQ · Upload PDF  
- Denser list rows: type badge, preview, Open PDF, Delete  
- Empty: “No knowledge yet. Add FAQ text or upload a PDF.” (SRD §8)

**Done when**

- [ ] Agent page reads like Botpress bot header  
- [ ] Knowledge stays fully functional  
- [ ] Ready for Phase 6 tabs (header stays, content swaps)

---

### Phase 4.5 — Chat + Conversations (SRD §9–10 + Botpress emulator density)

**Chat `/chat`**

Must include SRD §9:

- Agent picker (Botpress: agent context in header)  
- Welcome / history  
- User right (teal) / AI left (surface)  
- Input + send  
- Loading dots  
- Error + retry  

Layout: **one tall panel** filling remaining viewport under topbar (Botpress preview column), not a short card in the middle of a marketing page.

**Conversations**

- List: rows like Botpress Recent Activity / inbox — agent name, category, sentiment chips, message count, startedAt  
- Filter by agent  
- Detail: read-only bubbles + meta; link “Chat with agent”  
- Empty: “No conversations yet. Start a chat.”

**Done when**

- [ ] Chat is full-height emulator  
- [ ] Conversations look like a monitor inbox  
- [ ] All SRD chat/conversation UI pieces present  

---

### Phase 4.6 — Analytics layout + global states (SRD §15–16, §20)

**Why:** Botpress Analytics screenshot = card grid + time range + empty charts. Charts **data** = Phase 8. Phase 4 = **page skeleton** so the app doesn’t say “coming soon” in a stub card.

**`/analytics`**

```
PageHeader: Analytics
Range chips (UI only, default Last 7 days) — wire in Phase 8

Row: KPI cards (same SRD list; use existing overview API)
  Total Conversations | Messages | Avg Response Time
  Avg Conversation Length (0 until API) | Positive % | Negative %

Card: Conversation trend     → empty chart frame + “No conversations yet…”
Card: Topic distribution     → empty / Phase 8
Card: Sentiment distribution → empty / Phase 8
Card: Business insights      → empty copy until Phase 8
```

If overview API already returns KPIs, show them. Missing endpoints → honest empty state, **not** fake numbers.

**Global SRD §20**

- Loading skeletons everywhere Phase 4 touches  
- Error + retry  
- Success: keep existing toasts/list refresh for create/upload/delete  

**Done when**

- [ ] Analytics is a real page layout (not “coming soon” hero)  
- [ ] Empty/error/loading match SRD wording  
- [ ] Responsive: sidebar collapses; grids stack  

---

## 6. Page checklist vs SRD Definition of Done (UI only)

Phase 4 does **not** complete the whole SRD. It makes these **look finished**:

| SRD DoD | UI after Phase 4 |
|---------|------------------|
| Register / login | Auth pages: light polish only (optional) |
| Create agent | Redesigned form + list |
| Add knowledge | Redesigned knowledge |
| Chat with AI | Redesigned chat chrome (logic = Phase 5) |
| Conversations stored | Conversations inbox |
| Analytics visualized | Layout + existing overview KPIs; charts Phase 8 |
| Responsive | Sidebar + stacking |
| Errors handled | Empty / error / loading |

---

## 7. Implementation notes

- **No Prisma / API changes** except using APIs we already have (`overview`, `listAgents`, `listConversations`).  
- Reuse `MetricCard`, chat bubbles, knowledge dialogs — restyle, don’t rewrite business logic.  
- Remove app layout radial gradient if it fights the Botpress-calm workspace.  
- Primary CTA always **+ New agent** / **Send** in teal, never Botpress blue `#3b5bdb`.

### Suggested file touch list

```
app/(app)/layout.jsx
app/(app)/dashboard/page.jsx
app/(app)/agents/page.jsx
app/(app)/agents/[id]/page.jsx
app/(app)/agents/[id]/knowledge/page.jsx
app/(app)/agents/new/page.jsx
app/(app)/agents/[id]/edit/page.jsx
app/(app)/chat/page.jsx
app/(app)/conversations/page.jsx
app/(app)/conversations/[id]/page.jsx
app/(app)/analytics/page.jsx
components/layout/*
components/dashboard/*
components/agents/AgentCard.jsx
components/chat/ChatWorkspace.jsx
```

---

## 8. Visual QA (against your screenshots)

Compare **structure** only:

1. Home: sidebar + Create + cards + optional right rail  
2. Agent: hero + KPI row  
3. Analytics: card grid + empty chart language  
4. Lists: search + cards like Integrations grid  

Compare **brand**:

- Background light, not `#0c0c0c`  
- Accent teal `#0b5f58`  
- Fonts Instrument / DM  

---

## 9. Phase 4 master checklist

### 4.1 Shell
- [x] Sidebar + grouped Monitor nav  
- [x] Topbar breadcrumbs + user  
- [x] Mobile drawer  

### 4.2 Dashboard
- [x] SRD KPIs + shortcuts  
- [x] Agent cards + New agent  
- [x] No marketing hero  

### 4.3 Agents
- [ ] Search + card grid  
- [ ] Create/edit in shell  

### 4.4 Agent + Knowledge
- [ ] Overview hero  
- [ ] Knowledge toolbar + list  

### 4.5 Chat + Conversations
- [ ] Full-height chat (SRD §9)  
- [ ] Inbox + detail  

### 4.6 Analytics + states
- [ ] Analytics card layout (empty-ready)  
- [ ] Loading / empty / error  
- [ ] Responsive  

- [ ] **PHASE 4 REDESIGN DONE** → Phase 5 Chat E2E, then Phase 6 Studio tabs  

---

## 10. Later phases (do not pull into Phase 4)

| Phase | Uses this redesign |
|-------|-------------------|
| 5 Chat E2E | Same chat chrome |
| 6 Studio tabs | Hero stays; tabs under it (Overview / Instructions / Knowledge / Test / Share) |
| 7 Webchat | Share tab; not Integrations Hub |
| 8 Analytics | Fill 4.6 chart cards + insights |
| 9 Deploy | Same shell |

---

## 11. Copy snippets (SRD)

- Empty analytics: “No conversations yet. Start a conversation to see analytics.”  
- Error: “Unable to load conversations. Please try again.”  
- Knowledge empty: “No knowledge yet. Add FAQ text or upload a PDF.”
