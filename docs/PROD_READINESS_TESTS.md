# Production readiness tests — Phases 0–6

Tested one phase at a time against local app + Neon.  
**Goal:** catch blockers before Vercel deploy.

---

## Phase 0 — Setup ✅ (pass with warnings)

**Date:** 2026-08-14  
**Scope:** Next.js app, Prisma/Neon, health, env, globals, shadcn

### Checks run

| Check | Result | Notes |
|-------|--------|-------|
| `GET /api/health` | ✅ PASS | `{"status":"ok","service":"hapy-api"}` |
| Prisma schema validate | ✅ PASS | Valid |
| `prisma migrate status` | ✅ PASS | 5 migrations; DB up to date |
| Neon `SELECT 1` | ✅ PASS | Pooled URL connects |
| `.env` gitignored / not tracked | ✅ PASS | `.gitignore` + `git check-ignore` |
| `.env.example` documents secrets | ✅ PASS | DB, Auth, Google, OpenAI, Cloudinary |
| Local `.env` has required keys | ✅ PASS | All example keys present (+ legacy JWT_* leftover) |
| `prisma.config.ts` DATABASE + DIRECT | ✅ PASS | Correct Neon pattern |
| `postinstall` → `prisma generate` | ✅ PASS | Good for Vercel |
| Scripts `build` / `start` | ✅ PASS | Present in `package.json` |
| `globals.css` + shadcn `components/ui` | ✅ PASS | Present |
| README Phase 0 setup steps | ✅ PASS | Install → migrate → run |

### Warnings (fix before production, not Phase 0 blockers)

| # | Issue | Why it matters | Suggested fix |
|---|--------|----------------|---------------|
| W1 | Health does **not** ping the database | Vercel can be “healthy” while Neon is down | Extend `/api/health` with optional DB check |
| W2 | `AUTH_URL` / `NEXT_PUBLIC_APP_URL` are localhost in example | Prod auth redirects break if unset | Set real Vercel URL in prod env |
| W3 | Legacy `JWT_SECRET` / `JWT_EXPIRES_IN` still in local `.env` | Dead config; confusion | Remove from `.env` (not used by NextAuth) |
| W4 | Production `npm run build` not run in this Phase 0 pass | Catch compile errors early | Run full build in a later pass / Phase 10 |

### Verdict

**Phase 0 is production-ready for foundation** (app boots, DB migrates, secrets pattern OK). Address W1–W3 before go-live.

---

## Phase 1 — Auth ✅ (pass with warnings)

**Date:** 2026-08-14  
**Scope:** Register, credentials login, session, route guard, Google config, `/api/auth/me`

### Checks run

| Check | Result | Notes |
|-------|--------|-------|
| Unauthenticated `GET /api/agents` | ✅ PASS | `401` Missing or invalid session |
| Unauthenticated `/dashboard` | ✅ PASS | `307` → `/login?next=/dashboard` |
| Register validation (short password) | ✅ PASS | `400` + field details |
| Register success | ✅ PASS | `201`, user public fields only (no password hash) |
| Duplicate register | ✅ PASS | `409` Email already exists |
| CSRF token | ✅ PASS | Issued |
| Credentials sign-in | ✅ PASS | Session cookie set (`authjs.session-token`, HttpOnly) |
| `GET /api/auth/session` | ✅ PASS | user id/name/email + expires (~30d) |
| `GET /api/auth/me` | ✅ PASS | Same user |
| Protected API with session | ✅ PASS | `200` `{ agents: [] }` |
| Wrong password | ✅ PASS | Session remains `null` |
| `/login` + `/register` pages | ✅ PASS | `200` |
| `AUTH_SECRET` set | ✅ PASS | Present |
| Google Client ID (GIS) | ✅ PASS | `GOOGLE_CLIENT_ID` + public twin set |
| bcrypt hashing | ✅ PASS | `SALT_ROUNDS = 10` |
| NextAuth `trustHost: true` | ✅ PASS | Helps Vercel host detection |
| DIY JWT removed | ✅ PASS | Auth.js session only |

### Warnings (fix before production)

| # | Issue | Why it matters | Suggested fix |
|---|--------|----------------|---------------|
| W1 | No rate limit on register / login | Brute-force / spam accounts | Add rate limits (planned Phase 10) |
| W2 | `AUTH_URL` still `http://localhost:3000` | Prod redirects / cookies wrong if forgotten | Set Vercel HTTPS URL in prod env |
| W3 | Session cookie `Secure=false` on localhost | Expected locally; must be Secure on HTTPS | Deploy on HTTPS (Vercel) |
| W4 | Full Google OAuth secret missing | OK if GIS button only; OAuth redirect path disabled | Optional: set `AUTH_GOOGLE_SECRET` for classic OAuth |
| W5 | Google GIS end-to-end not automated here | Needs real browser Google popup | Manual smoke on `/login` before launch |
| W6 | Email verification not enforced | Anyone can register any email | Accept for MVP or add later |

### Verdict

**Phase 1 Auth is production-capable for email/password + session guards.** Add rate limits + correct prod `AUTH_URL` before public launch. Google GIS configured but needs one manual browser smoke test.

---

## Phase 2 — Agents + dashboard ✅ (pass with minor warnings)

**Date:** 2026-08-14  
**Scope:** Agents CRUD APIs, ownership isolation, analytics overview, dashboard/agents pages

### Checks run

| Check | Result | Notes |
|-------|--------|-------|
| `GET /api/agents` (auth) | ✅ PASS | `200` list |
| Create validation | ✅ PASS | `400` name / systemPrompt / welcomeMessage |
| Create agent | ✅ PASS | `201` |
| Get agent | ✅ PASS | `200` |
| Update agent | ✅ PASS | `200` name/description updated |
| Delete agent | ✅ PASS | `204` then `404` on get |
| Missing agent id | ✅ PASS | `404` |
| Foreign user GET | ✅ PASS | `403` Not allowed |
| Foreign user PUT | ✅ PASS | `403` |
| Foreign user DELETE | ✅ PASS | `403` |
| `GET /api/analytics/overview` | ✅ PASS | `200` KPI shape |
| Unauth overview | ✅ PASS | `401` |
| Overview `?agentId=` foreign | ✅ PASS | `403` (ownership via `getAgentForUser`) |
| Pages `/dashboard`, `/agents`, `/agents/new`, detail | ✅ PASS | `200` with session |

### Warnings

| # | Issue | Why it matters | Suggested fix |
|---|--------|----------------|---------------|
| W1 | Create/GET responses include `userId` | Mild info leak of internal id | Strip `userId` from public JSON if desired |
| W2 | Overview zeros when no conversations | Expected empty state | OK for prod |
| W3 | No pagination on `GET /api/agents` | Fine for MVP; scales poorly | Add later if many agents |

### Verdict

**Phase 2 is production-ready for multi-tenant agent CRUD + dashboard KPIs.** Ownership checks are solid.

---

## Phase 3 — Knowledge ✅ (pass)

**Date:** 2026-08-14  
**Scope:** TEXT + PDF knowledge, Cloudinary upload, extract, ownership, then **chat with agent using the PDF**

### PDF used

Created `/tmp/hapy-kb-test.pdf` with unique facts:

- Warranty code: **HAPY-KB-77491**
- Return window: **21 days from delivery**
- Support hours: Mon–Fri 9am–6pm Pakistan time

### Checks run

| Check | Result | Notes |
|-------|--------|-------|
| Unauth `GET .../knowledge` | ✅ PASS | `401` |
| Empty knowledge list | ✅ PASS | `{ documents: [] }` |
| TEXT validation | ✅ PASS | `400` name + content required |
| TEXT create | ✅ PASS | `201` Hours FAQ |
| Reject non-PDF upload | ✅ PASS | `400` Only PDF files are allowed |
| **Upload test PDF** | ✅ PASS | `201` type `PDF`, Cloudinary `fileUrl` + `publicId` |
| PDF text extract | ✅ PASS | Extracted content includes `HAPY-KB-77491` |
| List after upload | ✅ PASS | 2 docs: PDF + TEXT |
| Knowledge page | ✅ PASS | `200` `/agents/[id]/knowledge` |
| **Chat: warranty code + return window** | ✅ PASS | Reply: *The warranty code is **HAPY-KB-77491** and the return window is **21 days from delivery**.* |
| Foreign user list knowledge | ✅ PASS | `403` |
| Foreign user DELETE knowledge | ✅ PASS | `403` |
| Owner DELETE PDF | ✅ PASS | `204`; list drops to TEXT only |
| Chat after PDF deleted | ✅ PASS | New thread: *I do not know.* (does not invent the code) |

### Warnings

| # | Issue | Why it matters | Suggested fix |
|---|--------|----------------|---------------|
| W1 | PDF extract depends on selectable text | Scanned/image PDFs fail | Accept for MVP; OCR later |
| W2 | Knowledge content stored in Postgres | Large PDFs grow DB | OK for MVP; chunking later |
| W3 | No file-size test at 10MB boundary in this pass | Edge case | Optional later |

### Verdict

**Phase 3 is production-ready for TEXT + PDF knowledge.** Upload, Cloudinary, extract, ownership, and **agent chat from the PDF** all worked. After deleting the PDF, the agent no longer used those facts.

---

## UI polish (before Phase 4 test) ✅

**Date:** 2026-08-14  
**Scope:** Redesign Agent **Overview** + **Customization** studio, then smoke-test in browser.

### Overview (`/agents/[id]`)

Now a hub, not just three metrics + two text cards:

- Real KPIs from `/api/analytics/overview` (conversations, messages, avg response)
- Shortcuts: Test chat, Knowledge, Customization, Edit
- Setup checklist (welcome, prompt, knowledge, widget)
- Widget summary (color, theme, history)
- Recent conversations + knowledge count

### Customization (`/agents/[id]/customization`)

Studio layout:

- Header with Saved / Unsaved + Save
- Left section nav: Identity · Appearance · Deploy · Features
- Center form
- Right live preview

### Checks run

| Check | Result | Notes |
|-------|--------|-------|
| Overview page loads | ✅ PASS | Stats 2 / 4 / 1.3s on KB PDF Test Agent |
| Setup 4 of 4 | ✅ PASS | Ready to share |
| Shortcuts + Widget card | ✅ PASS | Color `#0b5f58`, History On |
| Customization studio | ✅ PASS | Identity/Appearance/Deploy/Features + preview |
| Save disabled when clean | ✅ PASS | |
| Dark toggle → Unsaved | ✅ PASS | Save enabled; reverted to Light without saving |
| PUT customization API | ✅ PASS | `cornerRadius: 14` persisted |

### Verdict

Redesign is live and usable. Phase 4 product-shell test can proceed next.

---

## Phase 4 — Redesign ✅ (pass with notes)

**Date:** 2026-08-14  
**Scope:** Botpress-like product shell with Hapy brand — sidebar, dashboard, agents, knowledge, chat chrome, conversations inbox, analytics layout (no new product APIs)

### Checks run

| Check | Result | Notes |
|-------|--------|-------|
| Unauth app routes (`/dashboard`, `/agents`, `/chat`, `/conversations`, `/analytics`, agent pages) | ✅ PASS | All `307` → login |
| Auth page loads (same set + `/agents/new`, knowledge, edit, agent analytics) | ✅ PASS | All `200` |
| Brand tokens | ✅ PASS | Primary `#0b5f58`, bg `#f3f6f7`, surface white, text `#0f172a` — not Botpress `#0c0c0c` |
| Sidebar + Monitor group | ✅ PASS | Home, Agents + Chat / Conversations / Analytics |
| Topbar breadcrumbs + account | ✅ PASS | Present on shell pages |
| Mobile drawer (code) | ✅ PASS | `AppShell` `menuOpen` overlay `md:hidden` |
| Dashboard KPIs + shortcuts | ✅ PASS | Conversations / Messages / Avg / Sentiment; Create Agent, Open Chat, View Analytics |
| No marketing / Chart integrations block | ✅ PASS | Removed |
| Agents search + card grid | ✅ PASS | Search agents; cards with Open / Chat / Knowledge |
| Create agent form in shell | ✅ PASS | `/agents/new` name, prompt, welcome |
| Agent hero + tabs | ✅ PASS | Overview / Knowledge / Analytics / Customization |
| Knowledge toolbar | ✅ PASS | Add Text / FAQ + Upload PDF + list |
| Chat full-height in shell | ✅ PASS | `main` overflow hidden; placements + widget preview |
| Conversations inbox | ✅ PASS | Search, agent filter, sentiment chips, select-thread empty state |
| Analytics card layout | ✅ PASS | Range chips + KPI grid + trend / topics / sentiment / insights |
| Overview API (shell KPIs) | ✅ PASS | Auth `200` shape; unauth `401` |

### Notes / warnings

| # | Issue | Why it matters | Suggested fix |
|---|--------|----------------|---------------|
| N1 | Analytics chart cards are labeled **Demo** (sample data) | Expected until Phase 9 real analytics | Fill with live series later |
| N2 | Phase 4 plan file checklist still has some unchecked boxes | Implementation marked done in master plan; this pass re-verified live | Optional: sync checkboxes in `PHASE4_REDESIGN_PLAN.md` |

### Verdict

**Phase 4 Redesign is production-ready as the Hapy product shell.** Light teal brand, consistent sidebar, and all SRD screens load inside the shell. Demo analytics charts are intentional placeholders.

---

## Phase 5 — Chat ✅ (pass with minor note)

**Date:** 2026-08-14  
**Scope:** Chat API + multi-turn UI, conversations list/detail, category/sentiment/responseTime, knowledge-grounded replies, ownership

### Test agent / knowledge

- Agent: **KB PDF Test Agent** `cmsssemcy000a4ci0gt1ohm3f`
- Added TEXT knowledge **Phase5 Hours Fact**: `PHASE5-SUPPORT-HOURS: Monday to Friday 9:00 AM to 6:00 PM Pakistan time. Weekends email only.`

### Checks run

| Check | Result | Notes |
|-------|--------|-------|
| Unauth `POST .../chat` | ✅ PASS | `401` |
| Unauth `GET /conversations` | ✅ PASS | `401` |
| Empty message | ✅ PASS | `400` Message is required |
| Chat turn 1 (OpenAI + KB) | ✅ PASS | Reply cites Mon–Fri 9–6 PKT + weekend email |
| Category + sentiment on chat | ✅ PASS | `SUPPORT` / `NEUTRAL` |
| Multi-turn same `conversationId` | ✅ PASS | Follow-up weekend policy kept thread |
| `GET /conversations?agentId=` | ✅ PASS | Thread listed |
| `GET /conversations/:id` messages | ✅ PASS | USER/ASSISTANT ×2; category/sentiment |
| Assistant `responseTime` on messages | ✅ PASS | e.g. 1379ms / 745ms |
| Foreign chat / list / get | ✅ PASS | All `403` |
| Missing conversation | ✅ PASS | `404` |
| Chat UI send + reply | ✅ PASS | Shows answer + ~1.2s timing |
| History control | ✅ PASS | Icon opens Chat history panel |
| Conversations inbox + detail | ✅ PASS | Transcript, SUPPORT label, continue/reply affordance |
| Markdown in past threads | ✅ PASS | Earlier warranty answer still shows `**bold**` markers in list/detail |

### Notes / warnings

| # | Issue | Why it matters | Suggested fix |
|---|--------|----------------|---------------|
| N1 | Top-level chat JSON has `message` + `userMessage` but not `responseTime` (time lives on saved ASSISTANT messages) | Mild contract drift vs older api-contract sample | Optional: add `responseTime` on chat response for clients |
| N2 | Mixed-language default (Chat F in test kit) not re-run in this pass | Language rule already documented | Optional manual kit run later |

### Verdict

**Phase 5 Chat is production-ready for authenticated chat, persistence, ownership, and inbox.** Knowledge-grounded answers and multi-turn work end-to-end with OpenAI.

---

## Phase 6 — Customization ✅ (pass with minor warning)

**Date:** 2026-08-14  
**Scope:** Agent Customization studio (Identity / Appearance / Deploy / Features), JSON API, avatar upload, live preview, `/chat` widget wiring

### Test agent

Created **Phase6 Customization Test** id `cmsstnb2g0000fpp40tapwqov` (owner: `prodtest-1786652473@example.com`)

### Checks run

| Check | Result | Notes |
|-------|--------|-------|
| Unauth `/agents/[id]/customization` | ✅ PASS | `307` → `/login?next=…` |
| Unauth `PUT` customization | ✅ PASS | `401` Missing or invalid session |
| New agent `customization: null` | ✅ PASS | Defaults applied in UI via `resolveCustomization` |
| Invalid primary color (`teal`) | ✅ PASS | `400` hex validation message |
| Unknown appearance key | ✅ PASS | `400` Unrecognized key (strict Zod) |
| PUT full identity/appearance/deploy/features | ✅ PASS | `200`; displayName, dark theme, proactive, feedback, uploads, `historyReset: 7d` |
| GET persists after save | ✅ PASS | Same values returned |
| Partial section merge | ✅ PASS | Theme/corner update keeps identity + features |
| Customization / chat / overview pages | ✅ PASS | `200` with session |
| Avatar empty multipart | ✅ PASS | `400` Image file is required |
| Avatar PNG upload (Cloudinary) | ✅ PASS | `201` + `avatarUrl`; saved on identity |
| Foreign GET / PUT / avatar / DELETE | ✅ PASS | All `403` Not allowed |
| Studio: Identity / Appearance / Deploy / Features | ✅ PASS | Grouped cards; Save disabled when clean |
| Dark toggle → Unsaved → Save | ✅ PASS | Badge + Save enable; persists `theme: dark` |
| Live preview | ✅ PASS | Name, footer, proactive, launcher near top of panel |
| Overview widget card | ✅ PASS | Phase6 Bot · dark · `#0b5f58` · History On |
| `/chat` applies customization | ✅ PASS | Header **Phase6 Bot**, dark shell, primary header, placeholder **Ask Phase6…**, footer **by Hapy Phase6**, history + feedback + attach file |
| Dashboard mock “Chart integrations” | ✅ PASS | Not present |

### Warnings

| # | Issue | Why it matters | Suggested fix |
|---|--------|----------------|---------------|
| W1 | `POST .../avatar` with no multipart body returns `500` | Bad clients get a vague error | Catch missing `formData` and return `400` like empty file |
| W2 | Public embed snippet is still a placeholder | Expected until Phase 8 | Real `/embed.js` later |
| W3 | File upload / feedback / sound are UI-wired; storage & analytics pipelines not built | OK for MVP customization | Later phases |

### Verdict

**Phase 6 Customization is production-ready for studio settings + persistence + chat preview wiring.** Ownership and validation are solid. Address W1 before public launch if avatar uploads are exposed widely; W2–W3 are known out-of-scope.

**Next pending prod tests:** Phase 4 Redesign shell, then Phase 5 Chat E2E.
