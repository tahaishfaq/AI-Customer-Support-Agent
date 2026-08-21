# Hapy — Admin Plan (one admin, two roles)

**Who this is for:** 1 developer, after product Phase **11 (Workspaces)**  
**App:** same Next.js + Neon + Prisma  
**Brand:** Hapy teal — `/admin` is a **second shell**, not a Botpress clone  
**Product plan:** `[NEXTJS_FULLSTACK_PLAN.md](NEXTJS_FULLSTACK_PLAN.md)` (workspaces = **Phase 11**, not this file)

> **Do not start Admin until Phase 11 Workspaces is DONE.**  
> Yeh file = **admin source of truth**. Product workspace UI yahan dubara plan nahi hota.

---

## Locked work order


| Step | What                                                    | When                   |
| ---- | ------------------------------------------------------- | ---------------------- |
| 1    | Finish Phase **11 Workspaces** in the product plan      | **First**              |
| 2    | **Admin in-scope** — **A0 → A6** in order               | After Phase 11 is live |
| 3    | **Admin out-of-scope** — **O1, then O2…** one at a time | After A0–A6 are DONE   |


---



## Roles (locked)

**Exactly two roles. Exactly one admin.**


| Role      | Who                                                        | Access                                                                                                                                  |
| --------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **USER**  | Har registered customer                                    | Sirf **apne** workspaces → agents → knowledge, chats, analytics                                                                         |
| **ADMIN** | **Ek hi** Hapy operator (env seed, no second admin invite) | **Har user** ki **har cheez** dekh sakta / inspect kar sakta hai — jo user product mein kar sakta hai, admin woh **sab** dekh sakta hai |


Admin **staff team** nahi hai. Superadmin / Support / Read-only **nahi**. `StaffAccount` table **nahi**.

```
USER  →  own workspaces only
ADMIN →  all users → all workspaces → all agents → knowledge, conversations,
         messages, analytics, insights, customization, embed keys (inspect)
```

Same NextAuth cookie is OK. Guard is `session.user.role === "ADMIN"` on `/admin` and `/api/admin/*`. Customer APIs stay `workspaceId` + owner scoped — **no** `?admin=1` backdoor on product routes.

---



## What admin can see (in-scope)

Admin directory is a **full inspect** of the product, not metadata-only:

- Users (search, status, last login)
- Each user’s **workspaces** (list, switch/open)
- Inside a workspace: **agents**, knowledge (TEXT/PDF/WEB **content**), **conversations + full transcripts**, studio test history if stored, customization, public embed status
- **Analytics / insights** for that user or that workspace (same charts as product, scoped to the target)
- Platform totals (users, workspaces, agents, chats)
- platorm growt chars on users, chats, embedings, agents, also oveall  resposne ans sentiments

Admin **dekhta** hai jo user dekhta hai. Product writes as that user (**act-as / impersonate**) = **out of scope (O1)**.

---



## Product shape after Phase 11 (admin must match this)

```
User  role: USER | ADMIN
 └── Workspace[]          (user can create many)
      └── Agent[]
           ├── KnowledgeDocument (TEXT / PDF / WEB)
           ├── Conversation → Message
           └── customization + publicKey
```

Tenant for USER APIs = **active workspace** owned by `session.user.id`.  
Admin APIs = **any** user + **any** of their workspaces.

---



## Production rules

1. **One admin.** Seed from `ADMIN_BOOTSTRAP_EMAIL` + `ADMIN_BOOTSTRAP_PASSWORD`. No `/admin/register`. No invite-staff UI.
2. **Cannot demote the last/only admin.** Cannot create a second `ADMIN` from the app in v1.
3. **Separate shell.** `/admin/`* uses `AdminShell`. No admin links in the customer sidebar.
4. **Customer APIs stay isolated.** Admin uses `/api/admin/`* only.
5. **Audit inspect opens.** Opening a user’s transcript / knowledge body writes `AuditEvent` (who, which user/workspace/agent, timestamp, IP). Reason optional in v1 because inspect **is** the job — still log it.
6. **Kill switch before delete.** Suspend user; disable agent / embed. Hard-delete = admin + type-email confirm.
7. Loading / empty / error on every admin page.
8. Rate-limit `/admin` login stricter than customer login.

---



## In scope vs out of scope



### In scope — Admin v1 (A0–A6)


| Area          | What the single admin can do                                    |
| ------------- | --------------------------------------------------------------- |
| Foundation    | `User.role`, seed the one admin, `/admin` shell + guards        |
| Users         | List/search users, open account, suspend / restore              |
| Workspaces    | List that user’s workspaces; open one as inspect context        |
| Agents        | All agents in that workspace; disable / re-enable; embed on/off |
| Knowledge     | Names **and** text/PDF extract (same as the user sees)          |
| Conversations | Full threads + reply history (read-only)                        |
| Analytics     | Workspace + agent insights (reuse Phase 9 APIs, admin-scoped)   |
| Safety        | Signup on/off, maintenance, global embed kill                   |
| Audit         | Log of admin inspect + suspend + delete                         |
| Legal         | Export one user (all workspaces) / hard-delete one user         |




### Out of scope — later (O1+)


| ID      | Module                                               | Why later                                |
| ------- | ---------------------------------------------------- | ---------------------------------------- |
| **O1**  | Impersonate (act as user — write in their workspace) | High abuse; v1 is inspect-only           |
| **O2**  | More than one admin / staff RBAC                     | Product decision: **one** admin          |
| **O3**  | Team members inside a workspace (invite others)      | Workspace is still **single-user owned** |
| **O4**  | Billing / Stripe / plans                             | Money                                    |
| **O5**  | WhatsApp / Slack / Discord admin                     | No product channels yet                  |
| **O6**  | Human desk                                           | Not in product                           |
| **O7**  | Flow canvas admin                                    | Not in product                           |
| **O8**  | Custom LLM / fine-tune                               | Not in product                           |
| **O9**  | Vector DB / global crawler console                   | Product crawl stays Phase 8              |
| **O10** | Customer SSO / SAML                                  | Enterprise                               |
| **O11** | Multi-region / residency                             | Infra                                    |


**Never unless product plan changes:** training on private customer data, open-web scrape, cloning Botpress billing.

---



## Architecture

```
app/(app)/*                 USER product (workspace switcher — Phase 11)
app/(auth)/login            shared login; role → /admin or /dashboard
app/admin/(console)/*       ADMIN shell

Prisma
  User.role                 USER | ADMIN   (exactly one ADMIN row)
  User.status               ACTIVE | SUSPENDED
  Workspace                 (from Phase 11)
  AuditEvent                adminId (= User.id), action, target, metadata, ip
  PlatformSettings          singleton
```

---



## Screens (`/admin`)


| Route                                                                            | Phase                                    |
| -------------------------------------------------------------------------------- | ---------------------------------------- |
| `/login`                                                                         | A0 — shared product login; ADMIN → `/admin` |
| `/admin`                                                                         | A1 dashboard (platform analytics)        |
| `/admin/users`                                                                   | A2                                       |
| `/admin/users/[id]`                                                              | A2 user + workspace list                 |
| `/admin/users/[id]/workspaces/[workspaceId]`                                     | A3 inspect workspace (agents, analytics) |
| `/admin/users/[id]/workspaces/[workspaceId]/agents/[agentId]`                    | A3 agent + knowledge + customization     |
| `/admin/users/[id]/workspaces/[workspaceId]/agents/[agentId]/conversations`      | A4                                       |
| `/admin/users/[id]/workspaces/[workspaceId]/agents/[agentId]/conversations/[id]` | A4 full thread                           |
| `/admin/safety`                                                                  | A5                                       |
| `/admin/audit`                                                                   | A6                                       |
| `/admin/settings`                                                                | A5 / A6                                  |


---



## API (`/api/admin/*`)

All: `role === ADMIN`.

```
GET    /api/admin/overview
GET    /api/admin/users?q=&status=
GET    /api/admin/users/[id]
POST   /api/admin/users/[id]/suspend
POST   /api/admin/users/[id]/restore
GET    /api/admin/users/[id]/export
DELETE /api/admin/users/[id]

GET    /api/admin/users/[id]/workspaces
GET    /api/admin/workspaces/[workspaceId]          // agents + analytics summary
GET    /api/admin/agents/[id]                       // full inspect (knowledge bodies)
GET    /api/admin/agents/[id]/conversations
GET    /api/admin/conversations/[id]                // full messages
POST   /api/admin/agents/[id]/disable
POST   /api/admin/agents/[id]/embed-disable

GET    /api/admin/analytics/dashboard?userId=&workspaceId=&range=
       // omit workspaceId → whole-platform analytics


GET    /api/admin/settings
PUT    /api/admin/settings
GET    /api/admin/audit
```

---



# In-scope phases

---



# A0 — One admin + guards

**Goal:** One `ADMIN` user exists; USER cannot hit `/api/admin`.

- Prisma `User.role` (`USER` default, `ADMIN`)
- Seed/upsert admin from env (no public register-as-admin)
- `/login` then redirect ADMIN → `/admin`, USER → `/dashboard`
- `requireAdmin()` on `/admin/*` and `/api/admin/*`
- USER cookie → 401 on admin APIs



### Checklist

- [x] Schema + seed one admin
- [x] Cannot register a second admin
- [x] USER cannot call `/api/admin/overview`
- [x] ADMIN cannot be used as a shortcut on `/api/agents` to list **all** agents (still workspace-scoped there)
- [x] **A0 DONE**

---



# A1 — Admin shell + overview

- `AdminShell` (Hapy tokens): Users / Safety / Audit
- KPIs: users, workspaces, agents, conversations (24h)
- Shortcuts into Users



### Checklist

- [x] Dashboard home (`/admin`) — platform analytics
- [x] Loading / empty / error
- [x] **A1 DONE**

---



# A2 — Users directory

- Search name/email, filter status
- User detail: profile, all **workspaces** (name, agent count, last activity)
- Suspend / restore (USER cannot login while suspended)



### Checklist

- [x] List + detail
- [x] Suspend blocks product login
- [x] Audit
- [x] **A2 DONE**

---



# A3 — Workspace + agent inspect

- Open a workspace: agent cards, workspace analytics (Phase 9 charts, that workspace only)
- Open an agent: system prompt, knowledge **content**, customization, embed status
- Disable agent / embed



### Checklist

- [x] Workspace inspect
- [x] Agent + knowledge bodies
- [x] Analytics for that workspace
- [x] Disable agent works on studio + public chat
- [x] **A3 DONE**

---



# A2b — Restore requests (login)

Suspended users see “disabled by admin” on login and can send a message. Admin reviews it on `/admin/requests` and the user detail page.

### Checklist

- [x] Login appeal form
- [x] Admin requests inbox
- [x] Restore closes pending requests

---



# A4 — Conversations inspect

- Per-agent inbox (same idea as product `/agents/[id]/conversations`)
- Full transcript read-only
- Audit `CONVERSATION_OPEN`



### Checklist

- [x] List + full thread
- [x] No reply-as-user (that is O1)
- [x] **A4 DONE**

---



# A5 — Safety + settings

- Signups on/off, maintenance mode, global embed kill
- Soft caps: max workspaces / agents (warn or block — product Phase 11 settings)



### Checklist

- [x] Toggles + audit
- [x] Embed kill on public widget
- [x] **A5 DONE**

---



# A6 — Audit + export/delete

- Filterable audit log (immutable)
- Export one user (all workspaces, agents, knowledge, conversations)
- Hard-delete with email confirm



### Checklist

- [x] Audit UI
- [x] Export + delete
- [x] **A6 DONE — Admin in-scope complete**

---



## Admin v1 definition of done

- [x] Only one ADMIN in the database
- [x] USER cannot use admin APIs
- [x] Admin can open any user’s workspace and see agents, knowledge, chats, analytics
- [x] Suspend + agent disable + embed kill work in production
- [x] Inspect actions appear in audit
- [x] README: how to seed the one admin
- [ ] Smoke on Vercel after Phase 11

**Stop.** Next intern/engineering work is `[POST_MVP_BACKLOG_PLAN.md](POST_MVP_BACKLOG_PLAN.md)` **P0**. Admin **O1 impersonate** only if you need to **write** as the user (that file **P3-IMPERSONATE**).

---



# Out-of-scope phases (later, one by one)



### O1 — Impersonate (act as user)

Banner “Viewing as X”, time-boxed, every write audited. Lets admin **create agents / reply** inside their workspace.

### O2 — Multiple admins

Only if one operator is not enough. Invite second ADMIN. Still no Support/Readonly matrix unless you reopen this file.

### O3 — Workspace members (teams)

Invite another USER into a workspace. Needs product Phase 11 schema + member table. Admin would then see members.

### O4 — Billing console (Stripe)



### O5 — Channels (WhatsApp / Slack)



### O6 — Human desk



### O7 — Flow canvas



### O8 — Model garden / fine-tune



### O9 — RAG job console (all crawl jobs)



### O10 — SSO / SCIM



### O11 — Residency / partners / CMS / SIEM

---



## Related docs


| File                                                   | Role                                            |
| ------------------------------------------------------ | ----------------------------------------------- |
| `[NEXTJS_FULLSTACK_PLAN.md](NEXTJS_FULLSTACK_PLAN.md)` | Phase **11 Workspaces** first, then this file   |
| `[POST_MVP_BACKLOG_PLAN.md](POST_MVP_BACKLOG_PLAN.md)` | Week 3, intern P0, named OOS **P3-*** (incl. O1+) |
| This file                                              | Admin in-scope **A0–A6** + out-of-scope **O1+** |


