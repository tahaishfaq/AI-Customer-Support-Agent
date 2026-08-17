# Hapy — Next.js Fullstack Plan (One Person)

**Who this is for:** 1 developer building everything alone  
**Framework:** Next.js (UI + API in one project)  
**Database:** Neon PostgreSQL + Prisma  
**Language:** JavaScript (`.js` / `.jsx`)  
**UI / product reference:** [Botpress](https://botpress.com/) Studio + Webchat  
**Botpress gap analysis:** `[BOTPRESS_GAP_PLAN.md](BOTPRESS_GAP_PLAN.md)`  
**App folder:** `AI-Customer-Support-Agent`  
**Components:** shadcn/ui + Tailwind + global CSS (colors & fonts)

> **Note:** Purane plans delete **nahi** kiye. Yeh file = **MVP phase source of truth**.

---

## Product north star (Botpress-aligned MVP)

```
Build agent → Add knowledge → Redesign (Hapy shell) → Chat → Customization → Studio Test/Share → Webchat embed + site knowledge → Analytics leftover → Deploy
```


| Botpress idea                     | Hapy MVP module                                | Phase    |
| --------------------------------- | ---------------------------------------------- | -------- |
| Cloud app shell + visual language | **Botpress-like redesign (Hapy colors/fonts)** | **4** ✅  |
| Knowledge (files)                 | TEXT + PDF (Cloudinary)                        | **3** ✅  |
| Emulator chat + history           | Chat + Conversations                           | **5** ✅  |
| Webchat settings / identity       | **Agent Customization**                        | **6** ✅  |
| Studio hub tabs                   | Agent Studio tabs + Test + Share               | **7** ✅  |
| **Webchat embed**                 | Public widget + snippet + **site knowledge crawl** | **8** ✅ |
| Analytics                         | Charts + insights (charts live; pulled forward)| **9** ✅ |
| Publish / deploy                  | Vercel + rate limits                           | **10** ✅ |


**Out of MVP (Phases 0–10):** flow canvas, WhatsApp/Slack, human desk, teams/billing, ADK.  
**After MVP (in-scope next):** **Phase 11 — multiple workspaces**, then **Admin** ([`ADMIN_SAAS_PLAN.md`](ADMIN_SAAS_PLAN.md)).

---

## Simple Idea

Ek Next.js app: `app/` = UI, `app/api/` = APIs, Neon + Prisma = DB.

---

## What You Will Build

### Done / core

1. Auth (NextAuth)
2. Dashboard KPIs
3. Agents CRUD
4. Knowledge (TEXT + PDF / Cloudinary)
5. Botpress-like redesign (Hapy shell)
6. Chat + Conversations (multi-turn, history; **per-agent inbox** in studio)
7. Agent Customization (Identity / Appearance / Deploy / Features)
8. Agent Studio (Overview / Knowledge / **Conversations** / Analytics / Customization / **Test** / **Share**)
9. Analytics dashboards (workspace + per-agent — live data)
10. **Vercel production** (live)

### Ordered next (after MVP)

1. **Phase 11 — Multiple workspaces** (this file, in-scope)
2. **Admin in-scope** — [`ADMIN_SAAS_PLAN.md`](ADMIN_SAAS_PLAN.md) A0–A6 (one admin; sees every user’s workspaces / agents / chats / analytics)
3. Admin **out-of-scope** O1+ (impersonate, extra admins, teams, billing, …)

---

## Tech Stack


| Part      | Choice                       |
| --------- | ---------------------------- |
| Framework | Next.js App Router           |
| UI        | React + Tailwind 4 + shadcn  |
| Auth      | Auth.js / NextAuth v5        |
| AI        | OpenAI                       |
| PDF       | **unpdf** + **Cloudinary**   |
| DB        | Neon + Prisma                |
| Hosting   | Vercel                       |


---

## Master Phase Checklist


| Phase  | Name                                    | Botpress map         | DONE |
| ------ | --------------------------------------- | -------------------- | ---- |
| 0      | Setup                                   | —                    | [x]  |
| 1      | Auth (NextAuth)                         | —                    | [x]  |
| 2      | Agents + dashboard                      | Agents               | [x]  |
| 3      | Knowledge + Cloudinary                  | Knowledge Bases      | [x]  |
| **4**  | **Botpress-like redesign (Hapy brand)** | **Cloud shell / UI** | [x]  |
| **5**  | **Chat + Conversations**                | Emulator + history   | [x]  |
| **6**  | **Agent Customization**                 | Webchat settings     | [x]  |
| **7**  | **Agent Studio tabs**                   | Studio hub           | [x]  |
| **8**  | **Webchat embed + site knowledge**      | Webchat              | [x]  |
| **9**  | **Analytics + Insights**                | Analytics            | [x]  |
| **10** | **Deploy + Polish**                     | Ship                 | [x]  |
| **11** | **Multiple workspaces**                 | Botpress switcher    | [x]  |


**Status (18 Aug 2026):** Phases **0–11 DONE**. Live: https://ai-customer-support-agent-ashen.vercel.app  
**Next in-scope:** Admin (one `ADMIN` + `USER` roles).

**MVP = Phases 0–10.** **Post-MVP in-scope = Phase 11 + Admin A0–A6.**  
**Renumber note (Aug 2026):** Customization inserted as **Phase 6**. Purana Studio / Webchat / Analytics / Deploy → **7 / 8 / 9 / 10**.

### Extra vs original (demo notes)

Jo extra kaam original checklist ke baad add hua — yeh table demo / yaad rakhne ke liye hai.

| Phase | Extra that shipped |
| ----- | ------------------ |
| **4** | Full-height `h-dvh` shell, content-only scroll, mobile drawer |
| **5** | Widget **history + resume**, Conversations inbox **reply**, `react-markdown` replies, reply **language from knowledge** (mixed → English) |
| **6** | Cloudinary **avatar**, `/chat` uses saved customization, Deploy snippet helper (`lib/customization/embed.js`) |
| **7** | Real **Test** + **Share** tabs, AI **question pack**, **Ask yourself auto-run** (pause / resume / stop) |
| **8** | Public embed snippet/`publicKey`, one-time website crawl → WEB knowledge |
| **9** | Real workspace + per-agent dashboards **before** Phase 8 (heatmap, topics, sentiment share, volume Lines/Bars, range 7d/30d/all) |
| **10** | Vercel live; Edge-safe `proxy.js` auth; **unpdf** PDF extract; conversations moved **into agent studio** |
| **11** | Workspace model + cookie `hapy_workspace`; top-left switcher (search / create / rename / delete) |

---

# PHASE 0 — Setup ✅

- [x] Next.js, Neon, Prisma, health, globals, shadcn, `.env.example`  
- [x] **PHASE 0 DONE**

---

# PHASE 1 — Auth ✅

NextAuth — `[NEXTAUTH_MIGRATION_PLAN.md](NEXTAUTH_MIGRATION_PLAN.md)`

- [x] Register / login / logout / Google / protected routes  
- [x] **PHASE 1 DONE**

---

# PHASE 2 — Dashboard + Agents ✅

`[PHASE2_BACKEND_PLAN.md](PHASE2_BACKEND_PLAN.md)` · `[PHASE2_FRONTEND_PLAN.md](PHASE2_FRONTEND_PLAN.md)`

- [x] Agents CRUD + dashboard overview  
- [x] **PHASE 2 DONE**

---

# PHASE 3 — Knowledge ✅

`[PHASE3_BACKEND_PLAN.md](PHASE3_BACKEND_PLAN.md)` · `[PHASE3_FRONTEND_PLAN.md](PHASE3_FRONTEND_PLAN.md)` · `[PHASE3_CLOUDINARY_PDF_PLAN.md](PHASE3_CLOUDINARY_PDF_PLAN.md)`

- [x] TEXT + PDF (Cloudinary) + Open PDF  
- [x] **PHASE 3 DONE**

---

# PHASE 4 — Botpress-like Redesign (Hapy colors & fonts) ✅

**Detailed plan:** `[PHASE4_REDESIGN_PLAN.md](PHASE4_REDESIGN_PLAN.md)`  
**SRD:** *Hapy — AI Customer Support & Customer Insights* (Dashboard, Agents, Knowledge, Chat, Conversations, Analytics UI)  
**Visual refs:** Botpress Cloud Home / Bot Overview / Analytics (structure only)

### Goal

Botpress Cloud jaisa **sidebar product** — Hapy teal + Instrument/DM fonts. SRD ke saare existing screens polish. Dark Botpress clone, billing, Integrations Hub **nahi**.

### Sub-phases (do in order)


| Sub | Screen                            | Botpress ref                  | SRD                 |
| --- | --------------------------------- | ----------------------------- | ------------------- |
| 4.1 | App shell (sidebar + breadcrumbs) | All screenshots               | §20 responsive      |
| 4.2 | Home / Dashboard                  | Workspace Home                | §6 KPIs + shortcuts |
| 4.3 | Agents list + forms               | Home / Integrations card grid | §7 CRUD             |
| 4.4 | Agent overview + Knowledge        | Bot Overview                  | §7–8                |
| 4.5 | Chat + Conversations              | Emulator / Monitor            | §9–10               |
| 4.6 | Analytics layout + empty/error    | Analytics grid                | §15–16, §20         |


### Rules

- **No** Botpress black/blue/purple theme  
- **No** canvas, billing, WhatsApp, Integrations marketplace

### Phase 4 Checklist

- [x] 4.1 Sidebar + topbar + mobile drawer  
- [x] 4.2 Dashboard SRD metrics (no marketing hero)  
- [x] 4.3 Agents card grid + create/edit in shell  
- [x] 4.4 Agent hero + knowledge toolbar  
- [x] 4.5 Full-height chat + conversations inbox (`h-dvh`, content-only scroll)  
- [x] 4.6 Analytics card layout (wired to live data in Phase 9 extras)  
- [x] **PHASE 4 DONE**  

---

# PHASE 5 — Chat + Conversations ✅

**Was:** old Phase 4  
**Plans (legacy filenames):** `[PHASE4_BACKEND_PLAN.md](PHASE4_BACKEND_PLAN.md)` · `[PHASE4_FRONTEND_PLAN.md](PHASE4_FRONTEND_PLAN.md)`  
**Test kit:** `[AGENT_TEST_KIT.md](AGENT_TEST_KIT.md)`

### Goal

User message → OpenAI → save messages + category/sentiment.

### Phase 5 Checklist

- [x] Chat API + multi-turn UI  
- [x] Conversations list + detail  
- [x] Category + sentiment + responseTime  
- [x] Full E2E with `OPENAI_API_KEY` (local testing done)  
- [x] UI sits cleanly inside Phase 4 shell  
- [x] Chat widget history + resume thread (icon-only History control)  
- [x] Reply / continue chat from Conversations inbox  
- [x] Assistant replies render with `react-markdown`  
- [x] Reply language from knowledge bases (mixed → English default)  
- [x] **PHASE 5 DONE**  

---

# PHASE 6 — Agent Customization ✅

**Detailed plan:** `[CUSTOMIZATION_PLAN.md](CUSTOMIZATION_PLAN.md)`  
**Notes / refs:** `[CUSTOMIZATION_NOTES.md](CUSTOMIZATION_NOTES.md)`  
**Maps to:** Botpress Webchat settings (Identity / Appearance / Deploy / Features)

### Goal

Agent page par **Customization** tab — live preview + Save. Hapy teal defaults (not Botpress dark/blue shell).

### Agent tabs

`Overview` · `Knowledge` · `Analytics` · **`Customization`** · `Test`

### Sections

| Section     | Content |
| ----------- | ------- |
| Identity    | Avatar, display name, description, placeholder, footer, contact, terms/privacy |
| Appearance  | Primary color, font, theme, header, message style, corner radius |
| Deploy      | Embed snippet (placeholder), Toggle/Embedded, launcher, button image, proactive message |
| Features    | Feedback, file upload, notification sound, conversation history, history reset |

### Phase 6 Checklist

- [x] Customization tab + `/agents/[id]/customization`  
- [x] Split layout (settings + live preview) + Save  
- [x] `Agent.customization` JSON + API validation/merge  
- [x] Identity + Appearance forms + preview theming  
- [x] Deploy settings UI + placeholder embed  
- [x] Features toggles + preview affordances  
- [x] Dashboard mock “Chart integrations” removed  
- [x] Avatar upload (Cloudinary)  
- [x] Apply saved customization on `/chat` widget  
- [x] Shared embed snippet helper (`lib/customization/embed.js`) — SSR-safe origin; used by Deploy  
- [x] **PHASE 6 DONE**

---

# PHASE 7 — Agent Studio tabs ✅

**Was:** old Phase 6 (Studio)  
**Maps to:** `[BOTPRESS_GAP_PLAN.md](BOTPRESS_GAP_PLAN.md)` B1 tabs (shell + Customization already exist)  
**Test kit:** `[AGENT_TEST_KIT.md](AGENT_TEST_KIT.md)` (Hapy Co scripts + Studio Test runner)

### Goal

One **Agent Studio** hub — same tabs everywhere, live Test emulator. Embed snippet lives in Customization → **Deploy**.

### Tabs

| Tab            | Route                         | Content |
| -------------- | ----------------------------- | ------- |
| Overview       | `/agents/[id]`                | Summary + shortcuts to Test / Customization |
| Knowledge      | `/agents/[id]/knowledge`      | Existing knowledge UI |
| Analytics      | `/agents/[id]/analytics`      | Per-agent live charts (Phase 9 pull-forward) |
| Customization  | `/agents/[id]/customization`  | Phase 6 — Identity / Appearance / **Deploy (embed snippet)** / Features |
| **Test**       | `/agents/[id]/test`           | Studio emulator + auto-run |

Shell: `AgentStudioFrame` + `STUDIO_TABS` + breadcrumbs (test / customization).

### Test tab (extra — remember this)

Two modes, left panel height matches the chat widget (`h-[min(640px,72vh)]`).

**1. Ask yourself (auto-run)**  
- User adds their own questions (max 20).  
- **Run test** sends them **one by one** in the **same conversation** — next question only after the agent replies.  
- **Pause** / **Resume** / **Stop** anytime.  
- Error pauses the run; Resume continues.  
- Progress: `N of M`, current row highlighted, sent rows marked.  
- While running: question list + composer locked so the queue cannot mix with typing.

**2. Question pack**  
- Starter scripts, or **Generate / Regenerate with AI** (`POST /api/agents/[id]/test-questions`).  
- Pack is built from agent name, prompt, and knowledge.  
- Each line is editable; **Send** still works one-at-a-time.

Also: **New chat**, **Open in Chat**, widget customization/theme/history in the emulator.

### Share tab (removed)

Embed snippet is **Customization → Deploy**. Old `/agents/[id]/share` redirects there. No separate Share tab.

### Phase 7 Checklist

- [x] Studio tabs: Overview · Knowledge · Analytics · Customization · Test  
- [x] Shared studio frame + breadcrumbs + Overview/hero shortcuts (Test)  
- [x] Test tab emulator (Ask yourself + Question pack)  
- [x] AI-generated test questions (`test-questions.service` + OpenAI JSON completion)  
- [x] **Ask yourself auto-run** — add questions → Run test → sequential send  
- [x] **Pause / Resume / Stop** on auto-run  
- [x] Apply Customization settings on `/chat` (done with Phase 6 polish)  
- [x] Embed snippet lives in Customization Deploy (Share tab removed)  
- [x] **PHASE 7 DONE**  

---

# PHASE 8 — Webchat embed + site knowledge

**Was:** old Phase 7  
**Maps to:** Botpress Webchat (gap B2) + **one-time** crawl of whichever site the widget is first installed on

> **Approval gate:** Site crawl (8.2–8.6) is designed below. **Do not implement 8.2+ until this section is approved.** Embed 8.1 can still ship first if crawl is delayed.

### Goal

1. Public embed bubble + snippet + theme; `POST /api/public/agents/[publicKey]/chat`.  
2. **Jahan bhi** owner widget lagaye: pehli dafa us website/app ke origin ko **ek hi baar** crawl karo, support pages knowledge/DB mein store, visitors ka better jawab.  
3. **Dobara auto-crawl nahi.** No daily refresh. Doosri site par snippet later paste ho to chat chalega, **doosra crawl nahi.**  
4. Agent **secrets / private pages / internals** expose nahi kare (host site ya Hapy).

Use Phase 6 Customization Deploy settings as the source of truth for theme / launcher / proactive.

### Why this is not “scrape the internet”

| Allowed | Not allowed |
| ------- | ----------- |
| The **first live origin** the widget reports (`window.location.origin`) | Owner-typed URL field, competing sites, repeating crawls |
| Public HTML (FAQ, help, pricing, shipping, about, contact) | `/admin`, `/login`, `/account`, `/api`, `.env`, dashboards |
| Visible page text after redaction | Cookies, localStorage, user sessions, hidden fields, JS secrets |
| Same host as that first origin (`www` vs apex = same site) | Every new domain the snippet is copied to |
| Owner can see / delete the auto KB | Silent recrawl when pages change |

---

### 8.1 — Public embed (widget)

- `Agent.publicKey` (unique, unguessable) + `embedEnabled`
- `GET /embed.js` + `GET /w/[publicKey]` (hosted widget)
- `POST /api/public/agents/[publicKey]/chat` — rate limited, no session cookie required
- On load, widget pings origin (`window.location.origin`) so the server can run **at most one** crawl (see 8.2)
- Share + Deploy snippets use real `publicKey` (replace Phase 6/7 placeholder)

---

### 8.2 — One-time crawl on first embed (no URL form)

Owner **does not** paste a “Website to learn from”. Discovery = embed.

**Lock on the agent (after first success)**

- `siteKnowledgeOrigin` — e.g. `https://shop.example.com`
- `siteCrawledAt` — set when the crawl **succeeds**

**When a crawl starts**

| Situation | Behavior |
| --------- | -------- |
| Widget loads, agent has **never** crawled, origin is `https` public host (not `localhost`) | Enqueue **one** job for that origin |
| Same origin, widget loads again / visitors come back | **No crawl** — use stored WEB knowledge |
| Widget later loads on a **different** origin | Chat works; **no crawl** (agent already used its one crawl) |
| First job **fails** | Same origin may retry until **first success**, then lock. Not a content recrawl |
| `localhost` / `127.0.0.1` | Never crawl (dev preview) |

No Share-field allowlist. No “Refresh from website” in Phase 8.

Knowledge tab: **Website** doc, source origin, crawled-at, status.

---

### 8.3 — Crawler (how it fetches)

**Job table** `SiteCrawlJob`: `id`, `agentId`, `origin`, `status` (`QUEUED`/`RUNNING`/`DONE`/`FAILED`), `pagesCrawled`, `error`, `startedAt`, `finishedAt`.

At most **one DONE job per agent**. Extra enqueue attempts are no-ops.

**Fetch rules (v1 — HTML GET only, no headless browser, no cookies, no JS execution)**

1. Use the embed origin; fetch `/` + `/robots.txt` + `/sitemap.xml` if present. **Honor robots.txt**.
2. Start URLs: homepage + sitemap paths that look support-related.
3. Path allow-hints (case-insensitive): `help`, `support`, `faq`, `docs`, `documentation`, `pricing`, `price`, `about`, `contact`, `shipping`, `delivery`, `returns`, `refund`, `warranty`, `privacy`, `terms`, `policy`, `how-to`, `getting-started`.
4. Follow same-host links **max 2 hops**, **max 25 pages**, **max 150 KB HTML each**, overall timeout ~45s (Vercel-friendly). Prefer sitemap hits over random crawl.
5. Skip: non-`https`, other hosts, `mailto:`, files (`.png` `.jpg` `.css` `.js` `.json` `.xml` except sitemap, `.pdf` in v1), query strings with `token`/`session`/`key`/`auth`, paths containing `admin`, `login`, `signin`, `signup`, `account`, `dashboard`, `wp-admin`, `api/`, `.git`, `.env`, `cart`, `checkout` (checkout often has no public FAQ).
6. Store **visible text** (strip nav mega-menus optionally, drop `<script>` `<style>` `<noscript>`).

**Do not:** crawl authenticated app screens, GraphQL with cookies, other customers’ sites, or anything behind robots `Disallow`.

---

### 8.4 — Store as knowledge (auto KB)

- Prisma: `KnowledgeType` add **`WEB`** (keep TEXT + PDF).
- `KnowledgeDocument`: `sourceUrl String?`, `origin String?`, `crawlJobId String?`.
- This crawl **writes WEB docs once**. It does **not** overwrite owner TEXT/PDF. There is **no recrawl replace** in Phase 8.
- After fetch: **redact** then either:
  - **Prefer:** one compiled doc `"Website — {host}"` — LLM turns cleaned pages into FAQ-style bullets (support facts only) + a short **Sources** list of URLs.
  - **Fallback:** one WEB doc per page (`title` + cleaned text) if the compile call fails.
- Knowledge UI: badge **Website**, Open/Preview (text), Delete (owner), **do not** show raw HTML. If they delete WEB docs, Phase 8 still **does not** crawl again (one-time already used).

Admin later (O9) is a **platform jobs console** — not this phase.

---

### 8.5 — Secrets, private details, chat refusals

**Before DB (redact)**

Strip or drop chunks matching:

- API keys / bearer tokens / `sk-` / AWS `AKIA` / PEM / JWT-shaped strings
- `password`, `secret`, `private key`, `internal only`
- `.env` style `KEY=value` lines
- Email **unless** it is a public `support@` / `hello@` / `contact@` style address on a contact page (keep those)
- Private IPs, `localhost` service URLs, connection strings

Pages that look like backups, dumps, or “staff only” → skip entire page.

**In the model prompt (every public + studio chat)**

- Answer **only** from knowledge + owner system prompt.
- Never invent admin URLs, credentials, API keys, or “how to get into the CMS.”
- If the visitor asks for secrets, source code, env, database, other customers, or Hapy internals → **refuse** in one short sentence. Do not paste redacted leftovers.
- Do not expose crawl machinery (“I scraped 23 pages…”). Say “from your website help pages” at most.
- Do not quote HTML comments, hidden inputs, or JS bundles.

Public widget users are **site visitors**. They already see the public site. The bar is: **no internals that the public HTML was not meant to teach.**

---

### 8.6 — Limits

- **One successful crawl per agent, ever**
- Failed first job: retry **same** origin until success, then lock
- Page/size caps as in 8.3
- Failed after retries: Knowledge shows error; owner TEXT/PDF still work
- Phase 10 rate limits cover the origin ping + public chat (so the one job cannot be stampeded)

---

### Out of Phase 8 (crawl)

- Recrawl / “Refresh from website” / 24h sync  
- Owner pasting a URL to crawl before embed  
- Second origin / blog subdomain as a second crawl  
- Headless browser / SPAs that render FAQ only in JS  
- PDF / sitemap-hosted files  
- Vector DB / embeddings (still prompt stuffing like Phase 3)  
- Admin crawl ops UI ([`ADMIN_SAAS_PLAN.md`](ADMIN_SAAS_PLAN.md) **O9**)

---

### Phase 8 Checklist

**8.1 Embed**

- [x] `publicKey` + `embedEnabled` (+ theme from customization)  
- [x] Public chat API + rate limit  
- [x] Embed widget on external page  
- [x] Deploy: real snippet + preview in Customization  

**8.2–8.6 Site knowledge** *(after approval)*

- [x] Widget origin ping → **one** crawl per agent (lock `siteKnowledgeOrigin` + `siteCrawledAt`)  
- [x] Skip `localhost`; skip crawl if already crawled  
- [x] Second origin: chat yes, crawl no  
- [x] `SiteCrawlJob` + robots/sitemap + 25-page HTML crawl  
- [x] `KnowledgeType.WEB` stored once (never clobber TEXT/PDF; no recrawl replace)  
- [x] Redact secrets before save + chat refusal rules  
- [x] Knowledge tab shows Website docs + crawled-at  

- [x] **PHASE 8 DONE**  

---


# PHASE 9 — Analytics + Insights (charts live)

**Was:** old Phase 8  
**Maps to:** gap B3  
**Note:** Charts were **pulled forward** while Studio (Phase 7) was in progress. Embed (Phase 8) is still next for ordered MVP.

### Surfaces

| Surface | Route | What it shows |
| ------- | ----- | ------------- |
| Workspace | `/analytics` | All agents: KPIs, volume area (7d / 30d / all), heatmap, topics, sentiment over time, latency, workload, agent radar |
| Per-agent | `/agents/[id]/analytics` | That agent only: KPIs, **Conversation trend** (Lines default + Bars toggle), topics donut+bars, **sentiment share** (not a second donut), sentiment over time (Lines / Stacked) |

### API

`GET /api/analytics/overview` · `topics` · `sentiment` · `trends` · **`dashboard`** (composed payload for both UIs)

Range: `7d` \| `30d` \| `all`. Empty range → empty chart, **no fake sample data**.

### Phase 9 Checklist

- [x] Charts APIs + `/analytics` UI (live Prisma aggregates)  
- [x] Per-agent analytics board (`/agents/[id]/analytics`)  
- [x] Volume trend: **Lines default**, Bars toggle (Mix removed on purpose)  
- [x] Sentiment: share meter (big %, strip, three tiles) — distinct from Topics  
- [x] Heatmap, topics mix, sentiment-over-time, workload labels, agent health radar  
- [x] Demo layout from Phase 4 replaced with real series  
- [x] Insights write-up + `docs/data-pipeline.md`  
- [x] **PHASE 9 DONE**  

---

# PHASE 10 — Deploy + Polish

**Was:** old Phase 9  
**Maps to:** gap B5  
**Live:** https://ai-customer-support-agent-ashen.vercel.app  

### Phase 10 Checklist

- [x] Public webchat rate limit (`POST /api/public/agents/[publicKey]/chat` ~20/min/IP)  
- [x] Public origin ping rate limit (`POST .../ping`)  
- [x] Rate limits on **register / login / studio chat / test-questions**  
- [x] Responsive shell (`h-dvh`, content-only scroll)  
- [x] Vercel + env + Neon migrations (production live)  
- [x] Smoke (API + pages): register → agent → TEXT/PDF knowledge → chat grounded → test-questions → **per-agent inbox** → analytics → public embed chat → crawl ping  
- [x] Go-live UI checklist documented in README  
- [x] README (production URL, embed snippet, customization, env list)  
- [x] `/api/health` pings Neon (`database: ok` / `503` if down)  
- [x] **PHASE 10 DONE**  

In-memory rate limit does not share counts across Vercel instances (acceptable for MVP). Redis/Upstash is post-MVP.  

---

# PHASE 11 — Multiple workspaces (in-scope)

**Maps to:** Botpress Cloud workspace switcher (top-left).  
**When:** after Phase 10. **Before** Admin (admin inspects these workspaces).

### Product rule

- **USER** owns **many workspaces**.
- Top-left (sidebar header, where “Hapy / Workspace” is today): **current workspace** + chevron.
- Dropdown (Hapy teal, not Botpress dark clone): search, list of *this user’s* workspaces, **+ Create a workspace**.
- Active workspace scopes **everything**: dashboard, agents, knowledge, conversations, analytics, customization, embed crawl origin.
- Agents **belong to a workspace**, not loosely to the user.
- Switching workspace does not log the user out.

### Data

```
User 1──* Workspace 1──* Agent (existing children: knowledge, conversations, …)
```

- First login: auto-create `Default Workspace` (or migrate all existing agents into one default workspace per user).
- `workspaceId` on `Agent`. Keep `userId` on Workspace only (owner).
- Session or cookie: `activeWorkspaceId` (must be owned by the user).
- Unique workspace **name per user** (trim, 1–60 chars).

### UI

- Trigger: icon + **workspace name** + muted line (e.g. “Personal”) + up/down chevron — same placement as the screenshot (top-left of the app shell).
- Popover: search “Search workspaces…”, list with check on active, footer **+ Create a workspace**.
- Create: name → new empty workspace → switch to it.
- Rename / delete workspace (delete only if empty, or move/delete agents with confirm) — include in this phase so Admin has a stable entity.
- Empty workspace: “Create your first agent”.

### APIs

```
GET    /api/workspaces
POST   /api/workspaces                 { name }
GET    /api/workspaces/[id]
PUT    /api/workspaces/[id]            { name }
DELETE /api/workspaces/[id]
POST   /api/workspaces/[id]/activate   // set active workspace
```

All customer agent/analytics/chat routes: **filter by active workspace**.  
Public embed unchanged (`publicKey` still on Agent).

### Checklist

- [x] Prisma migrate + backfill Default Workspace per existing user
- [x] Switcher UI (search, list, create) top-left
- [x] Agents / dashboard / analytics / conversations scoped to active workspace
- [x] Cannot open another user’s workspace by URL
- [x] Rename + delete (with confirm)
- [ ] Production smoke: two workspaces, agents do not leak across
- [x] **PHASE 11 DONE** (apply migration on Neon / Vercel before go-live of this phase)

---

## Optional post-MVP (after Phase 11 + Admin)

Streaming · Citations · Model picker · Headless/SPA crawl · extra origins (blog subdomain)

**After Phase 11:** Admin — [`ADMIN_SAAS_PLAN.md`](ADMIN_SAAS_PLAN.md) (in-scope **A0–A6**, then out-of-scope **O1+**).

---

## Out of scope (this product — do not start)

Yeh **main plan** ke bahar rehte hain jab tak explicitly na uthaya jaye. Admin-side later list: same file **O1+**.

| ID | Item | Notes |
| -- | ---- | ----- |
| **P-O1** | Flow canvas / visual bot builder | Never-MVP |
| **P-O2** | WhatsApp / Slack / Discord | Never-MVP |
| **P-O3** | Human desk / live handoff | Never-MVP |
| **P-O4** | Teams: invite other **users** into a workspace | Workspace stays single-owner; Admin **O3** |
| **P-O5** | Billing / Stripe / plans | Admin **O4** |
| **P-O6** | Vector RAG / embeddings | Knowledge stuffing stays |
| **P-O7** | Custom LLM / fine-tune | |
| **P-O8** | Multiple platform admins / staff RBAC | Admin is **one** person; Admin **O2** |
| **P-O9** | Impersonate (admin writes as user) | Admin **O1** |
| **P-O10** | Open-web / competitor crawl | Crawl = widget origin only |
| **P-O11** | Mobile app / SSO / SCIM | |

**Never:** training on private customer data; scraping arbitrary sites as a platform crawler.

---

## Daily Schedule


| Days | Focus                                |
| ---- | ------------------------------------ |
| ✅    | Phases 0–7                           |
| ✅    | Phase 9 charts (pulled forward)      |
| ✅    | Phase 8 embed + crawl                |
| ✅    | Phase 10 **Vercel live** + leftover (rate limits, README, health) |
| ✅    | **Phase 11 — Multiple workspaces**       |
| Next | **Admin in-scope** [`ADMIN_SAAS_PLAN.md`](ADMIN_SAAS_PLAN.md) A0–A6 |
| After Admin v1 | Admin out-of-scope **O1, then O2, …** (one at a time) |


---

## API Routes Map


| Area                      | Routes                                 | Phase |
| ------------------------- | -------------------------------------- | ----- |
| Auth / Agents / Knowledge | existing                               | 1–3   |
| Chat / Conversations      | existing                               | 5     |
| Agent Customization       | `PUT /api/agents/[id]` + avatar upload | **6** |
| Studio Test questions     | `POST /api/agents/[id]/test-questions` | **7** |
| Public Webchat            | `POST /public/agents/[publicKey]/chat` | **8** |
| Site crawl                | `POST /agents/[id]/site-crawl` + job   | **8** |
| Workspaces                | `GET/POST /api/workspaces`, activate | **11** |
| Analytics                 | overview, topics, sentiment, trends, **dashboard** | **9** |


---

## Pages Map


| URL                              | Phase                |
| -------------------------------- | -------------------- |
| `/dashboard`, `/agents`, …       | 2–3 + **4 redesign** |
| `/chat`                              | **5** (+ 4 layout)   |
| `/agents/[id]/conversations`         | **5** (moved from sidebar, Phase 10) |
| `/agents/[id]/conversations/[id]`    | **5** thread         |
| `/agents/[id]/customization`     | **6**                |
| `/agents/[id]/test`              | **7** Test emulator  |
| `/agents/[id]/customization`     | **6** Deploy snippet |
| `/w/[publicKey]`                 | **8**                |
| Knowledge **Website** docs       | **8** (auto from origin) |
| `/analytics`                     | **9** (live)         |
| `/agents/[id]/analytics`         | **9** (live)         |
| Top-left workspace switcher      | **11**               |


---

## Design Rules

1. Colors & fonts **only** via `globals.css` (Hapy)
2. Layout inspired by Botpress Cloud (**Phase 4**)
3. shadcn for controls
4. Sidebar from Phase 4 onward
5. Loading / empty / error everywhere

---

## Definition of Done (MVP)

- [x] Auth, Agents, Knowledge  
- [x] **Botpress-like redesign (Phase 4)**  
- [x] Chat + conversations (Phase 5; per-agent inbox)  
- [x] **Agent Customization (Phase 6)**  
- [x] Studio tabs polish (Phase 7) + **Test auto-run**  
- [x] Webchat embed + origin site knowledge (Phase 8)  
- [x] Analytics charts (Phase 9 — live) + `docs/data-pipeline.md`  
- [x] Deployed on Vercel (Phase 10)  
- [x] README + rate limits + health DB check (Phase 10)  
- [x] Phases **0–10** DONE  
- [x] Phase **11** workspaces (switcher + scope)  
- [ ] Admin A0–A6 ([`ADMIN_SAAS_PLAN.md`](ADMIN_SAAS_PLAN.md))  

---

## Related Docs


| File                                                             | Purpose                                      |
| ---------------------------------------------------------------- | -------------------------------------------- |
| **This file**                                                    | Phases 0–10 + **11 workspaces** + product out-of-scope |
| `[ADMIN_SAAS_PLAN.md](ADMIN_SAAS_PLAN.md)`                       | **After Phase 11:** one Admin, two roles, inspect all users |
| `[PHASE4_REDESIGN_PLAN.md](PHASE4_REDESIGN_PLAN.md)`             | **Phase 4 redesign** ✅                       |
| `[PHASE4_BACKEND_PLAN.md](PHASE4_BACKEND_PLAN.md)`               | Chat backend (**Phase 5** — legacy name) ✅   |
| `[PHASE4_FRONTEND_PLAN.md](PHASE4_FRONTEND_PLAN.md)`             | Chat frontend (**Phase 5** — legacy name) ✅  |
| `[CUSTOMIZATION_PLAN.md](CUSTOMIZATION_PLAN.md)`                 | **Phase 6 Customization** ✅                  |
| `[CUSTOMIZATION_NOTES.md](CUSTOMIZATION_NOTES.md)`               | Botpress Webchat refs for Customization      |
| `[AGENT_TEST_KIT.md](AGENT_TEST_KIT.md)`                         | Hapy Co scripts + **Studio Test auto-run**   |
| `[BOTPRESS_GAP_PLAN.md](BOTPRESS_GAP_PLAN.md)`                   | Gap analysis                                 |
| `[PHASE3_CLOUDINARY_PDF_PLAN.md](PHASE3_CLOUDINARY_PDF_PLAN.md)` | PDF hosting                                  |


**Phase 10 = live on Vercel (DONE). Phase 11 workspaces = implemented. Then one-admin inspect console.**
