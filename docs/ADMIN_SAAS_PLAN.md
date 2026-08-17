# Hapy — Platform Admin Plan (SaaS ops)

**Who this is for:** 1 developer, after the product MVP is finished  
**App:** `AI-Customer-Support-Agent` (same Next.js + Neon + Prisma)  
**Brand:** Hapy teal `#0b5f58` — admin is a **second shell**, not a Botpress clone  
**Product MVP plan:** [`NEXTJS_FULLSTACK_PLAN.md`](NEXTJS_FULLSTACK_PLAN.md)  
**Requirements POC / SRD:** *Hapy — AI Customer Support & Customer Insights* v1.0  

> **Do not start this plan until fullstack Phases 8–10 are DONE.**  
> Yeh file = **admin source of truth**. Product MVP yahan merge nahi hota.

---

## Locked work order


| Step | What | When |
| ---- | ---- | ---- |
| 1 | Finish [`NEXTJS_FULLSTACK_PLAN.md`](NEXTJS_FULLSTACK_PLAN.md) (Phase 8 embed → Phase 9 leftover → Phase 10 deploy) | **Now** |
| 2 | **Admin in-scope** — phases **A0 → A8** in order | After MVP is live |
| 3 | **Admin out-of-scope** — **O1, then O2, then O3…** one phase at a time | After A0–A8 are DONE |

Do not jump to Stripe, teams, WhatsApp, or multi-org until the matching **O** phase. In-scope complete = product ko operate kar sakte ho. Out-of-scope = product ko grow karte ho.

---

## Two different “admins” (do not mix)

SRD §3 *“Business/Admin User”* = **customer** — the person who registers, creates agents, chats, and views **their** analytics. Wo pehle se product mein hai (`User` → `Agent`). Uske liye naya `/admin` nahi banana.

Yeh plan **Platform Admin** hai — Hapy staff jo SaaS ko **chalata** hai:

```
Customer (existing MVP)          Platform staff (this plan)
/login  /dashboard  /agents      /admin/login  /admin
Own agents only                  All customers, all agents
Create knowledge, chat, embed    Suspend, inspect, kill-switch, audit
Pay later (out of MVP)           Cost / abuse / uptime (in-scope, no Stripe)
```

Agar staff aur customer **same session** share karein, yeh production nahi hai.

---

## What the SRD allows vs what SaaS needs

SRD goal: *“not a complete commercial SaaS”* — intern MVP. Ab product ko SaaS banana hai, isliye **ops admin** zaroori hai.

SRD §29 + fullstack “Never for MVP” **product** features ab bhi **admin in-scope se bahar** rehte hain. Unhe is file ke **Out of scope (O phases)** mein rakhte hain, delete nahi karte — taake baad mein one-by-one uthain.

| SRD / MVP said no | Admin v1 (this plan) | Later (O phases) |
| ----------------- | -------------------- | ---------------- |
| Multi-tenant SaaS, team management | Treat **one `User` = one account** (current schema) | **O1** Workspaces, **O2** Members + workspace RBAC |
| Billing / Stripe / subscriptions | **Usage + cost envelope** (token counts, volume) — **no money** | **O3** Billing console |
| Advanced RBAC (org roles) | **Staff RBAC only** (Superadmin / Admin / Support / Read-only) | **O2** customer-side roles |
| WhatsApp / Slack | No channel admin | **O5** |
| Website crawler, vector DB, custom LLM / fine-tune | No | **O8, O9** |
| Human desk | No | **O6** |
| Mobile app | No | **O10** |

---

## Product shape today (admin must match this)

```
User (customer)
 └── Agent
      ├── KnowledgeDocument (TEXT / PDF)
      ├── Conversation → Message
      └── customization JSON  (+ publicKey after Phase 8)
```

**No** Organization, Plan, Invoice, Member, Channel.

Admin v1 is a **control plane on top of this schema** — not a rewrite of the product.

---

## Production rules (non-negotiable)

1. **Same app, separate shell.** `/admin/*` uses `AdminShell`, never customer `AppShell`. Hapy tokens from `globals.css`.
2. **Staff ≠ customer.** `StaffAccount` table. Staff login is `/admin/login`. Customer JWT/session cannot hit `/api/admin/*`.
3. **No public staff signup.** First Superadmin from env seed. After that, only Superadmin invites staff.
4. **Every write is audited.** Who, what, which customer/agent, before/after summary, IP, timestamp.
5. **PII is a privilege.** Conversation transcripts default **hidden**. Support opens them with a **reason**; that open is audited.
6. **Kill switches beat deletion.** Suspend user / disable agent / disable embed first. Hard delete is Superadmin + confirm.
7. **Tenant isolation stays.** Admin APIs may **read across users**; customer APIs still `userId = session.user.id`.
8. **Idempotent, reversible where possible.** Un-suspend, re-enable embed. Deletes are the exception.
9. **Loading / empty / error** on every admin page (same SRD §20 bar as product).
10. **Do not impersonate in v1.** “View account” is read-only. Act-as-user = **O11**.

---

## In scope vs out of scope

### In scope — Admin v1 (build A0–A8)

Platform ko **is project ke current product** ke sath chalane ke liye yeh complete set hai:


| Area | What staff can do |
| ---- | ----------------- |
| Foundation | Staff auth, roles, `/admin` shell, route + API guards |
| Directory | Search customers, open account, suspend / restore, force logout |
| Agents | All agents on the platform, owner, status, disable agent, disable public embed |
| Usage | Platform KPIs: accounts, agents, chats, messages, avg latency, OpenAI-ish cost envelope |
| Safety | Abuse flags, disable embed globally or per agent, signup on/off, maintenance mode |
| Support | Read-only account + agent + knowledge **metadata**; transcripts gated |
| Audit | Append-only log of staff actions |
| Legal | Customer data export + Superadmin hard-delete of an account |
| Health | API health, failed chats count, last errors (no full APM product) |
| Settings | Defaults: max agents/user, max knowledge docs, public chat RPM |

### Out of scope — later, one by one (O1+)

Yeh **deliberately listed** hain. Production SaaS mein yeh exist karte hain — **is build order mein nahi.**


| ID | Module | Why later |
| -- | ------ | --------- |
| **O1** | Workspaces / Organizations | SRD §29 multi-tenant; schema is still User-owned agents |
| **O2** | Team members + workspace RBAC | SRD §29 team / advanced RBAC |
| **O3** | Billing console (Stripe, plans, invoices, dunning) | SRD §29 billing |
| **O4** | Plan quotas that **block** product (hard caps per paid plan) | Needs O3 |
| **O5** | Channel / integrations admin (WhatsApp, Slack, Discord) | SRD §29 + fullstack never-MVP |
| **O6** | Human desk / live handoff admin | Fullstack out of MVP |
| **O7** | Flow canvas / bot builder admin | Fullstack out of MVP |
| **O8** | Custom LLM / fine-tune / model garden | SRD §29 |
| **O9** | Vector DB / crawler job console | SRD §29 |
| **O10** | Mobile app / push admin | SRD §29 |
| **O11** | Impersonate “Act as user” (write in their workspace) | High abuse risk; v1 is view-only |
| **O12** | Customer SSO / SAML / SCIM | Enterprise, needs O1–O2 |
| **O13** | Multi-region / data residency | Infra, not this app yet |
| **O14** | Partner / reseller portal | Separate business line |
| **O15** | Marketing CMS / blog / changelog admin | Not the product |
| **O16** | Full SIEM, SOC2 evidence warehouse | Process + tools outside this repo |

**Never in this repo unless the product plan changes:** training customer models on private data, scraping arbitrary sites as a platform-wide crawler, cloning Botpress billing.

---

## Architecture (fits this codebase)

```
Next.js App Router
├── app/(app)/*              customer product (existing)
├── app/(auth)/*             /login /register (customers)
├── app/admin/(auth)/login   staff only
└── app/admin/(console)/*    staff console

lib/admin/
├── require-staff.js         API + RSC guard
├── audit.js                 write AuditEvent
├── kill-switch.js           user / agent / embed / signup
└── usage.js                 aggregates for platform KPIs

Prisma
├── StaffAccount, StaffSession
├── AuditEvent
├── AccountStatus on User
├── Agent.disabledAt / embedEnabled (embedEnabled may already exist from Phase 8)
├── PlatformSettings (singleton JSON)
└── UsageDaily (optional rollup)
```

Auth stack: same Auth.js, **separate cookie name** for staff (e.g. `hapy-staff-session`) so logging out of admin does not smash a customer tab, and a stolen customer cookie cannot call `/api/admin`.

---

## Data model (admin v1 only)

Do **not** introduce Organization, Plan, or Member until the matching O phase.

```
enum StaffRole {
  SUPERADMIN   // invite staff, hard-delete, platform settings
  ADMIN        // suspend, disable agents/embed, export
  SUPPORT      // view + gated transcripts + suspend with reason
  READONLY     // dashboards only
}

enum AccountStatus {
  ACTIVE
  SUSPENDED
  PENDING_DELETE
}

StaffAccount
  id, name, email unique, passwordHash
  role StaffRole
  status ACTIVE | DISABLED
  lastLoginAt, createdAt, updatedAt
  invitedByStaffId?

StaffSession          // or Auth.js tables scoped to staff
  sessionToken, staffId, expires, ip, userAgent

AuditEvent
  id
  staffId
  action            // USER_SUSPEND, AGENT_DISABLE, TRANSCRIPT_OPEN, SETTINGS_UPDATE, …
  targetType        // USER | AGENT | CONVERSATION | SETTINGS | STAFF
  targetId
  reason            // required for suspend / transcript / delete
  metadata Json     // before/after, counts
  ip, userAgent
  createdAt
  @@index([createdAt])
  @@index([staffId])
  @@index([targetType, targetId])

User (existing +)
  status AccountStatus @default(ACTIVE)
  suspendedAt DateTime?
  suspendedReason String?
  // do NOT put StaffRole on User

Agent (existing +)
  disabledAt DateTime?
  disabledReason String?
  // embedEnabled + publicKey — expected from Phase 8

PlatformSettings singleton
  id = "default"
  signupsEnabled Boolean
  maintenanceMode Boolean
  publicChatRpm Int
  maxAgentsPerUser Int
  maxKnowledgeDocsPerAgent Int
  embedKillSwitch Boolean   // global: all public widgets off
  updatedAt, updatedByStaffId

UsageDaily (optional, A3)
  date, userId?, agentId?
  conversations Int
  messages Int
  promptTokens Int
  completionTokens Int
  @@unique([date, userId, agentId])
```

Phase 8 embed fields (`publicKey`, `embedEnabled`) are **product** work. Admin only **toggles** them.

---

## Screens (`/admin`)


| Route | Phase | Who |
| ----- | ----- | --- |
| `/admin/login` | A0 | Public (staff form only) |
| `/admin` | A1 | Overview KPIs |
| `/admin/customers` | A2 | Search / filter / status |
| `/admin/customers/[id]` | A2 | Account, agents, usage, actions |
| `/admin/agents` | A2 | Global agent inventory |
| `/admin/agents/[id]` | A2 | Owner, knowledge meta, embed status, disable |
| `/admin/usage` | A3 | Volume + cost envelope |
| `/admin/safety` | A4 | Flags, global kill switches |
| `/admin/conversations` | A5 | Metadata list; body behind “View with reason” |
| `/admin/conversations/[id]` | A5 | Gated transcript |
| `/admin/health` | A6 | Health, recent failures |
| `/admin/audit` | A7 | Audit browser |
| `/admin/settings` | A8 | PlatformSettings + staff list (Superadmin) |
| `/admin/staff` | A0 / A8 | Invite / disable staff (Superadmin) |

Customer product URLs stay unchanged. **No** admin links in the customer sidebar.

---

## API (`/api/admin/*`)

All routes: staff session **required**. Role checked per verb.

```
POST   /api/admin/auth/login
POST   /api/admin/auth/logout

GET    /api/admin/overview

GET    /api/admin/customers?q=&status=&page=
GET    /api/admin/customers/[id]
POST   /api/admin/customers/[id]/suspend
POST   /api/admin/customers/[id]/restore
POST   /api/admin/customers/[id]/force-logout
POST   /api/admin/customers/[id]/export          // GDPR zip/json
DELETE /api/admin/customers/[id]                 // Superadmin hard-delete

GET    /api/admin/agents?q=&status=&userId=
GET    /api/admin/agents/[id]
POST   /api/admin/agents/[id]/disable
POST   /api/admin/agents/[id]/enable
POST   /api/admin/agents/[id]/embed-disable
POST   /api/admin/agents/[id]/embed-enable

GET    /api/admin/usage?range=7d|30d|all

GET    /api/admin/conversations?agentId=&userId=
GET    /api/admin/conversations/[id]             // metadata always; messages only after reason
POST   /api/admin/conversations/[id]/open        // { reason } then GET includes messages

GET    /api/admin/health
GET    /api/admin/audit?staffId=&action=&from=&to=

GET    /api/admin/settings
PUT    /api/admin/settings                       // Superadmin / Admin

GET    /api/admin/staff
POST   /api/admin/staff                          // invite Superadmin
POST   /api/admin/staff/[id]/disable
```

Customer routes **never** grow a `?admin=1` backdoor.

---

# In-scope phases

Implement **in this order**. Next phase starts only after the checklist is `[x]` and smoke-tested.

---

# A0 — Staff foundation

**Goal:** A second login that cannot touch customer data yet — except proving the guard works.

### Build

- Prisma: `StaffAccount`, `StaffSession` (or Auth.js staff tables), `StaffRole`
- Seed Superadmin from `ADMIN_BOOTSTRAP_EMAIL` + `ADMIN_BOOTSTRAP_PASSWORD` (env, never committed)
- `/admin/login` — email/password, no Google on staff v1 (phishing surface)
- `/admin` placeholder “signed in as …”
- Middleware: `/admin/*` except login → staff session; `/api/admin/*` → staff session
- Customer session on `/admin` → redirect to `/admin/login` (do not auto-promote)
- Separate session cookie
- `requireStaff(role)` helper

### Checklist

- [ ] Schema + seed
- [ ] Staff login / logout
- [ ] Customer cookie cannot call `/api/admin/overview` (401)
- [ ] Staff cookie cannot call `/api/agents` as if they owned customers (unless they also have a customer `User` — still scoped to that user)
- [ ] No “Register as admin”
- [ ] **A0 DONE**

---

# A1 — Admin shell + platform overview

**Goal:** Staff home that looks like Hapy ops, not the customer dashboard.

### Build

- `AdminShell`: sidebar groups **Operate / Safety / System**
- Topbar: staff name, role badge, logout
- `/admin` KPIs (can be zeros on day one, then live in A3): customers, agents, conversations (24h), suspended accounts, disabled agents, public chats (24h)
- Shortcuts: Customers, Agents, Audit, Settings
- Empty: “No customers yet.”
- READONLY can see this page

### Checklist

- [ ] AdminShell + nav
- [ ] Overview cards + loading/empty/error
- [ ] Role badge visible
- [ ] Mobile drawer (same bar as product)
- [ ] **A1 DONE**

---

# A2 — Customers + agents directory

**Goal:** Find any account or agent; suspend a customer; disable an agent or its embed.

### Build

- Customer list: search email/name, filter status, createdAt
- Customer detail: profile, status, agent cards (counts only), recent activity timestamps
- Actions: Suspend (reason required), Restore, Force logout (invalidate sessions)
- Agent list: name, owner email, created, disabled, embed on/off (after Phase 8)
- Agent detail: prompt length, knowledge doc **names/types only**, conversation counts — **not** document text, **not** transcripts
- Disable agent → customer `/chat` + public embed reject with a clear error
- Suspended user → login still possible? **No** — login returns a dedicated error; Google too

### Effects on existing product

- `User.status` checked in NextAuth `jwt` / middleware
- `Agent.disabledAt` checked in chat + public webchat

### Checklist

- [ ] Customers list/detail
- [ ] Suspend / restore / force logout + audit
- [ ] Agents list/detail (metadata)
- [ ] Disable / enable agent + embed
- [ ] Suspended customer cannot use product
- [ ] Disabled agent cannot chat
- [ ] **A2 DONE**

---

# A3 — Platform usage + cost envelope

**Goal:** Know if the SaaS is busy and roughly what OpenAI is costing — **without Stripe**.

### Build

- Capture `promptTokens` / `completionTokens` on assistant `Message` when the LLM returns usage (product-side small patch)
- `GET /api/admin/usage` + `/admin/usage`
- KPIs: chats, messages, tokens, estimated USD (unit price in PlatformSettings, editable)
- Break down by customer and by agent (tables, not a new analytics product)
- Reuse chart patterns from Phase 9 (Lines default) — **platform** series, not sampled fake data

This is **ops**, not SRD customer analytics. Customer `/analytics` stays per-user.

### Checklist

- [ ] Token fields stored on new assistant messages
- [ ] Usage page range 7d / 30d / all
- [ ] Top customers / top agents by volume
- [ ] Estimated cost using settings prices
- [ ] **A3 DONE**

---

# A4 — Safety + kill switches

**Goal:** Stop bleed without wiping the database.

### Build

`/admin/safety` + `PlatformSettings`:

- Global **signups enabled**
- Global **maintenance mode** (customer app reads this; staff still in)
- Global **embed kill switch** (all public widgets 503 with friendly copy)
- Per-agent embed already in A2
- Simple **flag queue**: staff can mark an agent/customer `FLAGGED` with a reason (field on User/Agent or `SafetyFlag` table)

Maintenance: customers see a full-page “We’ll be back” except `/admin`.

### Checklist

- [ ] Settings toggles + audit
- [ ] Signup blocked when off
- [ ] Embed global kill verified on a public widget
- [ ] Maintenance page for customers
- [ ] Flag list
- [ ] **A4 DONE**

---

# A5 — Support inbox (gated transcripts)

**Goal:** Help a customer without turning admin into a spyware desk.

### Build

- Conversation list: agent, owner email, category, sentiment, startedAt, message count — **snippet off by default**
- Open transcript: modal **reason** (min 8 chars) → `TRANSCRIPT_OPEN` audit → then messages
- Read-only. No “reply as the bot”, no edit, no delete in v1
- Knowledge **file names** visible on agent page; extracted PDF **body** not shown in v1 (too much PII)

READONLY: list + metadata, **cannot** open transcripts.

### Checklist

- [ ] List + filters
- [ ] Reason required; audited
- [ ] Messages only after open
- [ ] READONLY blocked from open
- [ ] **A5 DONE**

---

# A6 — Health

**Goal:** One page that answers “is chat on fire?”

### Build

- Reuse `/api/health` and add staff-only `/api/admin/health`: db ping, last 50 chat **errors** (store `ChatError` or log table: agentId, userId, status, message, createdAt)
- Product patch: persist failed public/auth chat errors (no payload secrets)
- Counters: 5xx last 24h, p95 responseTime from Message

Not in v1: Datadog, Sentry product clone, log drain UI. Wire Sentry **env** in Phase 10 product if you want — admin just **links** the dashboard.

### Checklist

- [ ] Health page
- [ ] DB ping (this was a known product leftover — ok to fix here for admin)
- [ ] Recent failures table
- [ ] **A6 DONE**

---

# A7 — Audit log

**Goal:** You can answer “who disabled that embed?”

### Build

- All previous phases must already write `AuditEvent`
- `/admin/audit` filters: staff, action, target, date
- Rows immutable in app code (no PATCH/DELETE API)
- Export CSV for Superadmin

### Checklist

- [ ] Filterable audit UI
- [ ] Spot-check: suspend, transcript open, settings change all appear
- [ ] No edit/delete of events
- [ ] **A7 DONE**

---

# A8 — Settings, staff, legal

**Goal:** Run the platform day-to-day; leave cleanly.

### Build

- `/admin/settings`: RPM, max agents, max knowledge docs, token USD rates, signups, maintenance, embed kill (A4 can live here too)
- `/admin/staff`: invite (email + temp password or invite link), role, disable staff. Last Superadmin cannot be disabled
- Customer **export**: JSON of that user’s agents, knowledge **names**, conversations (include messages). Download + audit `USER_EXPORT`
- Customer **hard delete**: Superadmin, type email to confirm, cascade (existing Prisma cascade). Audit `USER_DELETE`. Prefer `PENDING_DELETE` + 24h grace if you have time; otherwise immediate with confirm is acceptable for v1

### Checklist

- [ ] Settings save + audit
- [ ] Invite staff + disable staff
- [ ] Export
- [ ] Hard delete with confirm
- [ ] Last Superadmin protected
- [ ] **A8 DONE — Admin in-scope complete**

---

## Admin v1 definition of done

- [ ] Staff cannot register themselves
- [ ] Customer session cannot use admin APIs
- [ ] Suspend stops product access
- [ ] Disable agent + embed kill work on **auth chat and public embed**
- [ ] Transcripts require a reason and show in audit
- [ ] Platform usage page has real numbers (empty allowed)
- [ ] Settings persist
- [ ] At least two staff roles tested (ADMIN vs READONLY)
- [ ] README: how to seed Superadmin, how admin differs from customer
- [ ] Smoke after deploy (Phase 10 must already exist)

When this list is done, **stop**. Next work is **O1** only if you choose to expand the product into workspaces.

---

# Out-of-scope phases (later, one by one)

Har O phase **apna start rule** rakhta hai. Pehle wala O complete + product impact understood, tab agla.

---

### O1 — Workspaces (Organizations)

**Unlocks:** real multi-tenant SaaS (SRD explicitly skipped this).

- `Workspace` owns `Agent` (migrate `Agent.userId` → `workspaceId` + `WorkspaceMember`)
- Admin directory becomes Workspace → members → agents
- Customer UI: switcher, “Hapy Workspace” becomes a real entity
- Data migration from single-user accounts

**Do not start O2 until O1 migration is done.**

---

### O2 — Team members + workspace RBAC

**Unlocks:** owner / admin / member (SRD “team management / advanced RBAC”).

- Invite by email, seats, remove member
- Member cannot delete workspace
- Admin console: members table, role changes, audit
- Still no SSO (that is O12)

---

### O3 — Billing console

**Unlocks:** SRD billing / Stripe / subscriptions.

- Stripe customer per workspace
- Plans: Free / Pro / … (decide then)
- Admin: invoices, failed payments, complimentary access, refund log
- Customer billing portal is **product**; this phase is **staff** view + webhooks health
- No Botpress “AI spend” vanity clone required

---

### O4 — Enforced plan quotas

Depends on O3. Hard-block extra agents, knowledge MB, public RPM per plan. Admin override (comp, trial) with audit.

---

### O5 — Channels admin

WhatsApp / Slack / Discord connection status, disconnect, webhook failures. **No** building WhatsApp inside O5 unless product plan adds it first.

---

### O6 — Human desk admin

Queues, assignment, SLA. Only if product gets a desk.

---

### O7 — Canvas / flow builder admin

Skip until product has a canvas.

---

### O8 — Model garden / fine-tune

Bring-your-own key, model picker at workspace level, disable a model globally. **No** training on customer data by default.

---

### O9 — RAG / crawler ops

Product crawl (allowlisted public HTML → WEB knowledge) is **Phase 8**. This O phase is a **staff** jobs console (all agents’ crawl queues, stuck jobs, index size). Not a generic internet scraper.

---

### O10 — Mobile / push

Device tokens, campaign send. Out until a mobile app exists.

---

### O11 — Impersonate (act as user)

Time-boxed token, banner “You are viewing as X”, every write extra-audited, two-person Superadmin approve optional. **After** A8 + real support volume.

---

### O12 — Customer SSO / SCIM

SAML, Google Workspace enforcement, SCIM deprovision. Needs O1–O2.

---

### O13+ — Residency, partners, CMS, SIEM

Separate decisions. Do not pull into A phases.

---

## Security notes (v1)

- Rate-limit `/admin/login` (stricter than customer login)
- Staff passwords: hashed, min length, no reuse of bootstrap after first login (force change)
- Admin APIs: CSRF same-site cookies; no CORS to arbitrary origins
- Export files: short-lived, not public Cloudinary
- Audit metadata: **never** store full transcript in `AuditEvent` (ids + reason only)
- Staff READONLY is a real role, not a UI hide

---

## What this plan will not do to the product

- No billing UI on `/dashboard`
- No teams UI on `/agents` until O1–O2
- No Integrations Hub
- No mixing staff into `User.role` as a shortcut
- No admin tab inside Agent Studio

Admin is **orthogonal** to Phase 8 embed, Phase 9 charts, Phase 10 deploy.

---

## Related docs


| File | Role |
| ---- | ---- |
| [`NEXTJS_FULLSTACK_PLAN.md`](NEXTJS_FULLSTACK_PLAN.md) | Finish **first** |
| SRD v1.0 (docx) | Customer MVP + §29 out of scope |
| [`PROD_READINESS_TESTS.md`](PROD_READINESS_TESTS.md) | Product tests; add an Admin appendix after A8 |
| This file | Platform Admin in-scope A0–A8 + later O1+ |

---

**Sequence reminder:** Product 8 → 9 leftover → 10 → **A0–A8** → then **O1**, then **O2**, then the next O you actually need.
