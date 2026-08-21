# Hapy — Week 3, intern leftovers, and named out-of-scope backlog

**Who this is for:** after product Phases **0–11** and Admin **A0–A6**.  
**Sources:** internship doc *Hapy — AI Customer Support & Customer Insights* §28 Optional Week 3, §29 Out of Scope, §30 Definition of Done; `[NEXTJS_FULLSTACK_PLAN.md](NEXTJS_FULLSTACK_PLAN.md)`; `[ADMIN_SAAS_PLAN.md](ADMIN_SAAS_PLAN.md)`; live app review (login/register/admin 404).  
**Rule from the internship doc:** Week 3 = *choose only a few engineering items*. *Do not expand the product horizontally.* Out-of-scope stays named here so it is planned, not forgotten — **do not start P3+ until this file is explicitly reopened.**

**Competitor deep audits (Zendesk / Intercom / Botpress) + fusion roadmap:** [`AUDIT_ZENDESK_VS_HAPY.md`](AUDIT_ZENDESK_VS_HAPY.md) · [`AUDIT_INTERCOM_VS_HAPY.md`](AUDIT_INTERCOM_VS_HAPY.md) · [`AUDIT_BOTPRESS_VS_HAPY.md`](AUDIT_BOTPRESS_VS_HAPY.md) · [`FUSION_PLAN_HAPY_UNIQUE.md`](FUSION_PLAN_HAPY_UNIQUE.md).

This file is the **priority-ordered backlog**. Checkboxes are the work remaining, not history of Phases 0–11.

---



## Already shipped (do not re-plan as new product)


| Area                                                                                     | Status                                                                                         |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Week 1 foundation (auth, agents, knowledge, AI chat)                                     | Live                                                                                           |
| Week 2 intelligence (store chats, classify topic/sentiment, analytics APIs + dashboards) | Live                                                                                           |
| Embed widget, origin lock, one-time site crawl                                           | Live (internship §29 listed crawler as OOS; product Phase 8 still built **origin-only** crawl) |
| Customization, studio test, workspaces, Admin A0–A6, admin **platform** analytics        | Live                                                                                           |
| Admin tests `npm run test:admin`                                                         | Live (local)                                                                                   |


---



## Priority map (read this first)


| Band      | Name                                                               | When                                       | Horizontal product? |
| --------- | ------------------------------------------------------------------ | ------------------------------------------ | ------------------- |
| **P0**    | Intern DoD leftovers + production + auth bug                       | **Now**                                    | No                  |
| **P1**    | Internship Optional Week 3 (pick 2–3 those are v-imp, not all)     | After P0                                   | No                  |
| **P2**    | Gaps on **already shipped** surfaces                               | After P0, parallel with P1 if small        | No                  |
| **P3**    | Named **out-of-scope** (internship §29 + product P-O* + admin O1+) | Only if product decision changes this file | Yes — later         |
| **Never** | Training on private customer data; open-web competitor scrape      | —                                          | —                   |


**Suggested calendar (if finishing the internship pack):**

1. **Week A — P0 only**
2. **Week B — P1: pick two of {prompts, errors/logging, UI polish, performance}**
3. **Week C — demo, README, intern review**
4. **Later — P3 one ID at a time** (admin plan already says O1 then O2…)

---



# P0 — Must finish intern Definition of Done + live quality

Internship §30 still has items that are process/ops, not new screens. Browser pass on `/login` and `/register` found a concrete bug.

---



### P0-1 — Google sign-in stuck on “Loading Google…”

**Observed:** `/login` and `/register` accessibility tree shows `Loading Google…` instead of the GIS button. Email/password still works.

**Why it matters:** First-time users and the marketing split layout look broken; Google is a primary signup path when signups are open.

**Depth:**

- Reproduce: cold load `/login` and `/register` with `NEXT_PUBLIC_GOOGLE_CLIENT_ID` set; check network for GIS script; check `GoogleSignInButton` for client-only load, CSP, `useEffect` race, adblock.
- Admin Google is **intentionally disabled** (reserved bootstrap email). USER Google must still render.
- When signups are closed, Google first-time signup must still fail with the existing `SignupsClosedError` path — do not “fix” by allowing ghost accounts.
- Empty/error: if GIS fails, show “Continue with Google unavailable” + email form, never infinite Loading.

**Done when:** button appears within ~2s or a real error; no stuck Loading; screenshot on login + register.

**Code:** `GoogleSignInButton` retries GIS + layout, times out only if the GIS script never loads, and never leaves infinite Loading. Local verify on `/login` + `/register` (deploy is P0-2).

---



### P0-2 — Production / Vercel smoke

**Why:** Internship DoD: *Application is deployed*. Admin v1 DoD still has “Smoke on Vercel”. Phase 11 checklist still has two-workspace leak smoke.

**Depth — product:**

- Deployed `AUTH_URL` / `NEXT_PUBLIC_APP_URL` HTTPS, no trailing slash.
- `npx prisma migrate deploy` on production Neon.
- User A: two workspaces, agent only in W1; switch to W2; `/api/agents` does not list W1 agents; direct URL to W1 agent 404.
- User B cannot open User A workspace/agent URLs.
- Widget: `/w/{publicKey}` on allowed origin; ping locks origin; second agent cannot steal origin.
- Chat + classify persist; `/analytics` shows that chat.

**Depth — admin:**

- USER hitting `/admin` → 404 (already true locally).
- ADMIN email/password → `/admin` (dashboard) → Users → workspace → agent → transcript.
- Suspend blocks login; embed kill hides `/w/{key}`; export JSON; cannot delete last admin.

**Done when:** written smoke notes (pass/fail) against the live URL. Do not mark done from localhost only.

**Blocked:** needs Vercel access. Checklist: [`docs/VERCEL_SMOKE.md`](VERCEL_SMOKE.md).

---



### P0-3 — Automated tests + CI (Week 3 item, treated as P0)

Internship Week 3 lists *Automated tests* and *CI/CD*. Admin has `scripts/test-a0.mjs` + `scripts/test-admin-v1.mjs`. Product happy path is not in CI.

**Depth:**

- Script (or Playwright later): register → login → create agent → TEXT knowledge → studio chat → `GET /api/conversations/{id}` has USER+ASSISTANT + `category`/`sentiment` → `GET /api/analytics/dashboard`.
- GitHub Action: `npm ci`, `prisma generate`, lint, `npm run test:admin` **against a preview URL or skip HTTP tests if no server**, plus a product smoke job that needs `DATABASE_URL` secrets.
- Do not require RAG or billing tests.

**Done when:** PR cannot merge if smoke script fails on CI (or documented skip for missing secrets).

**Code:** `scripts/test-product.mjs`, `npm run test:product`, `.github/workflows/ci.yml`. Lint always. HTTP smoke skips with a README note when GitHub secrets are empty.

---



### P0-4 — README, repo hygiene, final demo

Internship §30–31: README complete, GitHub organized, reviewed by both interns, final presentation.

**Depth:**

- README: local run, env table, `seed:admin`, workspaces, embed snippet, “admin signs in at `/login`”, no `/admin/register`.
- No committed `.env`. Migrations listed.
- 8–12 slide / 5-minute demo: problem → agent + knowledge → chat → insights → embed → admin inspect (optional).
- Intern review checklist signed (process, not code).

**Done when:** a stranger can clone + `.env.example` + run; demo script exists in `docs/` or README.

**Code:** README clone path + env + workspaces + migrations list; [`docs/DEMO_SCRIPT.md`](DEMO_SCRIPT.md); [`docs/INTERN_REVIEW_CHECKLIST.md`](INTERN_REVIEW_CHECKLIST.md) (names/dates are process — fill when you review). `.env` stays gitignored.

---



### P0-5 — Critical errors visible to the user (DoD)

**Depth:** Chat/classify/OpenAI down → saved user message + safe assistant error, no white screen. Crawl fail → job `FAILED` + UI. Register validation and rate-limit 429 copy. Maintenance mode already exists — verify product shell shows it.

**Code:** OpenAI failure still **200** with USER saved + assistant “couldn’t reach the AI…”. Classify already falls back to GENERAL/NEUTRAL. Knowledge list shows crawl `FAILED` / queued. Register 400 details + 429 copy via `formatApiError`. Product layout already shows `MaintenanceScreen` for non-admin.

---



# P1 — Optional Week 3 (internship §28)

Doc text: *If the team gets additional time: Engineering & Enhancement. Choose only a few.*

Do **not** implement this entire band. After P0, **pick two or three IDs**. The rest stay unchecked.

---



### W3-1 — Better knowledge retrieval *(Week 3 list; overlaps OOS vector DB)*

**Internship wording:** Better knowledge retrieval **and** RAG/embeddings as separate bullets.

**Now:** retrieval is prompt-stuffing of TEXT/PDF/WEB chunks (`chat.service` + knowledge docs).

**In-scope for P1 (allowed):** tighter chunk selection (keyword / recency / token budget), better stuffing order, redact already exists for crawl.

**Out of scope for P1:** Pinecone/pgvector, embedding pipelines, hybrid search — that is **P3-RAG** / product **P-O6**.

**Done when (P1 slice):** long knowledge bases no longer truncate blindly; cited titles in the stuffed prompt; no new database engine.

---



### W3-2 — RAG / embeddings

**Name in internship Week 3 *and* §29 Out of Scope (“Complex vector database infrastructure”).**

Treat as **P3-RAG**, not P1. See below.

---



### W3-3 — Better AI prompts

**Depth:**

- System prompt templates: grounding (“only from knowledge”), language match, short vs long answers.
- Classify prompt: stable JSON, fewer `GENERAL`/`NEUTRAL` defaults when the chat is clearly sales/negative.
- Studio test questions stay aligned with the live system prompt.
- No model garden / per-tenant LLM keys (that is **P3-O8** / **P-O7**).

**Done when:** same knowledge PDF, refund question still answers from FAQ; classify spot-check on 20 chats.

---



### W3-4 — Logging

**Depth:** structured logs for chat, classify, crawl, public ping, admin audit already in DB. Add request id, agent id, duration; never log raw PII/message bodies in production by default. Optional request-id header.

**Done when:** one failed chat can be found in Vercel logs without the customer transcript dumped.

---



### W3-5 — Performance optimization

**Observed:** admin platform dashboard ~1s locally; reply mix shows many 1–2s and 2–4s assistant replies (model bound).

**Depth:**

- Analytics: avoid loading all agents’ full conversation sets unbounded; cap / SQL aggregates for platform growth.
- Chat: do not block the HTTP response on classify if you later move classify to after-return (careful: analytics would lag one request).
- Indexes already on agentId/conversation — verify explain on Neon.

**Done when:** platform dashboard p95 documented; no change to answer quality required.

---



### W3-6 — Better analytics

Product `/analytics` and admin dashboard `/admin` **exist**. P1 only if a **named gap** is filed (e.g. export CSV, date compare). Do not rebuild charts for Week 3 credit.

---



### W3-7 — UI/UX polish + responsive (DoD: application is responsive)

**Depth:**

- Auth split layout vs mobile: marketing column hidden or stacked; Google slot never empty height.
- Agent studio tab bar (already scrollbar-tweaked): check 375px width.
- Admin analytics 11 KPI cells: wrap without overlapping labels.
- Empty/error/loading already a product rule — audit remaining pages.

**Done when:** login, dashboard, one agent studio, `/analytics`, `/admin` usable at 375 and 1280.

---



### W3-8 — CI/CD

Covered under **P0-3**. Extra: preview deploys, `migrate deploy` in release, not `migrate dev` on Vercel.

---



# P2 — Small gaps on shipped product (not new modules)

Do these only if they bite users. Not internship Week 3 “new features.”


| ID       | Gap                                           | Notes                                                                                                                  |
| -------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **P2-1** | Workspace leak smoke on production            | Phase 11 checkbox                                                                                                      |
| **P2-2** | Admin analytics / sidebar density             | Mostly done; only regressions                                                                                          |
| **P2-3** | Unique embed origin edge cases                | localhost vs www vs trailing slash — already normalized; document in README                                            |
| **P2-4** | Product optional post-MVP from fullstack plan | Streaming, citations, model picker, headless SPA crawl, extra origins — **not Week 3**; treat as **P3-product-extras** |


---



# P3 — Named out-of-scope (deep plan, do not start)

Each item is named so it is **planned**, with why it is later, dependencies, and a future sketch. Starting any of these **is** horizontal expansion unless this section is explicitly opened.

Crosswalk: internship §29 ↔ product `P-O*` ↔ admin `O*`.

---



## P3-BILLING — Billing, Stripe, subscriptions

**Internship §29:** ❌ Billing, ❌ Stripe, ❌ Subscription management  
**Product:** **P-O5**  
**Admin:** **O4**

**Why later:** money, tax, dunning, entitlements; intern MVP is usage of one product, not a plan matrix.

**Dependencies:** `User`/`Workspace` stable; legal entity; Stripe account; webhook endpoint on AUTH_URL.

**Future sketch (when opened):**

- `Plan` + `Subscription` on User or Workspace; Stripe customer id.
- Caps already sketched in `PlatformSettings` (max workspaces/agents) — wire to plan instead of global soft caps.
- Admin billing console: which user is past due; no Botpress clone required.
- Customer: `/settings/billing`, customer portal.

**Not now:** fake paywalls, half Stripe keys in `.env`.

**Done when (future):** checkout → webhook → cap enforced on `POST /api/agents`.

---



## P3-TEAMS — Team management + advanced RBAC

**Internship:** ❌ Team management, ❌ Advanced RBAC, ❌ Multi-tenant SaaS  
**Product:** **P-O4** (invite others into a workspace)  
**Admin:** **O3** (workspace members), **O2** (multiple admins — different)

**Why later:** workspace is **single-user owned**. Multi-tenant SaaS in the intern sense meant “many companies in one app with staff roles,” which you already have as **many USERs + one ADMIN**. “Team management” means **several USERs inside one workspace**.

**Dependencies:** product schema `WorkspaceMember` (userId, workspaceId, role OWNER/EDITOR/VIEWER); invites; email.

**Future sketch:**

- Invite flow, accept token, member list on workspace settings.
- APIs stay scoped to membership not only `workspace.userId`.
- Admin inspect shows members.
- Do not confuse with **P3-ADMIN-STAFF** (many platform operators).

**Done when (future):** two USERs chat/knowledge in the same workspace without sharing a password.

---



## P3-ADMIN-STAFF — More than one platform admin / staff RBAC

**Product:** **P-O8**  
**Admin:** **O2**

**Why later:** locked product decision: **exactly one ADMIN**. Unique index `User_single_admin_role`.

**Future sketch:** invite second ADMIN or SUPPORT/READONLY; drop unique admin index; audit every grant. High political/abuse cost.

---



## P3-IMPERSONATE — Admin act-as-user (writes)

**Product:** **P-O9**  
**Admin:** **O1** (next in admin file after A0–A6, still **out of intern Week 3**)

**Why later:** high abuse; v1 admin is inspect-only.

**Future sketch:** banner “Viewing as X”, time-box, every write `AuditEvent`, cannot impersonate ADMIN. Lets admin create agents / reply as the user.

**Do not** add `?admin=1` on product APIs.

---



## P3-CHANNELS — WhatsApp / Slack / Discord / mobile app

**Internship:** ❌ WhatsApp, ❌ Slack, ❌ Mobile application  
**Product:** **P-O2**, **P-O11** (mobile grouped with SSO)  
**Admin:** **O5**

**Why later:** no product channel adapters; embed webchat is the channel.

**Future sketch:** `ChannelAccount` per agent; inbound webhook; map to `Conversation`/`Message`; admin channel health.

**Mobile:** not a React Native rewrite in this repo until web MVP is frozen.

---



## P3-DESK — Human desk / live handoff

**Product:** **P-O3**  
**Admin:** **O6**

**Why later:** not in product. Needs assignment, presence, SLA.

**Future sketch:** conversation status OPEN/WAITING_HUMAN/RESOLVED; operator inbox **inside the customer workspace**, not only admin.

---



## P3-FLOWS — Flow canvas / visual bot builder

**Product:** **P-O1**  
**Admin:** **O7**

**Why later:** never-MVP; Hapy is prompt + knowledge, not Botpress Studio flows.

---



## P3-RAG — Vector RAG / embeddings / “better retrieval” as a platform

**Internship Week 3 bullet *and* §29 complex vector DB / advanced ML**  
**Product:** **P-O6**

**Why later:** current design is stuffing; vector infra is a new product.

**Future sketch:** embed chunks on knowledge upload; `match_documents` SQL; citation UI. Token + cost. **Do not train on private customer data** (Never).

**P1 W3-1** may improve stuffing without this ID.

---



## P3-LLM — Custom LLM training / fine-tune / model garden

**Internship:** ❌ Custom LLM training, ❌ Fine-tuning, ❌ Advanced ML models  
**Product:** **P-O7**  
**Admin:** **O8**

**Why later:** not in product; data policy (Never: train on private customer data).

**Future sketch:** model picker per agent (optional post-MVP in fullstack plan) is **smaller** than fine-tune — if opened, treat as **P3-MODEL-PICKER** under product extras, still not fine-tune.

---



## P3-CRAWL-WEB — Open-web / competitor / global crawler console

**Internship:** ❌ Website crawler *(product still did origin crawl)*  
**Product:** **P-O10**  
**Admin:** **O9**

**Now:** one-time crawl of the **widget’s locked https origin** only.

**Out of scope:** scrape arbitrary URLs, recrawl-as-a-service, platform-wide crawl jobs UI.

**Future sketch:** job console for **that origin only**, still no competitor sites.

---



## P3-SSO — Customer SSO / SAML / SCIM

**Product:** **P-O11**  
**Admin:** **O10**

**Why later:** enterprise. Google USER login is enough.

---



## P3-RESIDENCY — Multi-region / residency / SIEM / partners

**Admin:** **O11**

**Why later:** infra. Neon region is already a choice, not a product feature.

---



## P3-PRODUCT-EXTRAS — Fullstack “optional post-MVP” (not intern Week 3)

From `[NEXTJS_FULLSTACK_PLAN.md](NEXTJS_FULLSTACK_PLAN.md)`: Streaming · Citations · Model picker · Headless/SPA crawl · extra origins (blog subdomain).

**Depth (when opened, one at a time):**


| Extra              | What                                            | Risk                                                           |
| ------------------ | ----------------------------------------------- | -------------------------------------------------------------- |
| Streaming          | SSE/token stream on studio + public chat        | Timeouts, embed JS                                             |
| Citations          | Show which knowledge doc grounded the answer    | Needs retrieval IDs                                            |
| Model picker       | `gpt-4.1-mini` vs other OpenAI models per agent | Cost, admin abuse                                              |
| Headless/SPA crawl | JS-rendered sites                               | Compute, still **same origin**                                 |
| Extra origins      | Second host (www vs app vs blog)                | Breaks 1 agent ↔ 1 origin rule — **product decision required** |


---



# Never (do not plan a build)

- Training **on private customer conversations/knowledge**
- Platform-wide scrape of sites the customer does not own
- Cloning Botpress billing/UX as a goal
- `?admin=1` backdoor on customer APIs

---



## Master checklist (mark when a band is actually started)



### P0

- [x] P0-1 Google button *(code done; confirm locally on /login + /register)*
- [x] P0-2 Vercel smoke *(product pass 2026-08-20; admin login on live still fail — see docs/VERCEL_SMOKE.md)*
- [x] P0-3 Tests + CI *(lint always; HTTP smoke skips without GitHub secrets)*
- [x] P0-4 README + demo *(interns still fill the review checklist)*
- [x] P0-5 Critical errors



### P1 (tick only what you chose)

- [ ] W3-1 Stuffing retrieval (not vector)
- [ ] W3-3 Prompts
- [ ] W3-4 Logging
- [ ] W3-5 Performance
- [ ] W3-6 Analytics gap (only if named)
- [ ] W3-7 UI/responsive
- [x] W3-8 CI (done in P0-3)



### P3 (leave unchecked until explicitly opened)

- [ ] P3-BILLING
- [ ] P3-TEAMS
- [ ] P3-ADMIN-STAFF
- [ ] P3-IMPERSONATE
- [ ] P3-CHANNELS
- [ ] P3-DESK
- [ ] P3-FLOWS
- [ ] P3-RAG
- [ ] P3-LLM
- [ ] P3-CRAWL-WEB
- [ ] P3-SSO
- [ ] P3-RESIDENCY
- [ ] P3-PRODUCT-EXTRAS (split when opened)

---



## Related docs


| File                                                   | Role                                   |
| ------------------------------------------------------ | -------------------------------------- |
| Internship `.docx` §28–31                              | Original Week 3 / OOS / DoD wording    |
| This file                                              | **Priority backlog + named OOS depth** |
| `[NEXTJS_FULLSTACK_PLAN.md](NEXTJS_FULLSTACK_PLAN.md)` | Phases 0–11 + product P-O*             |
| `[ADMIN_SAAS_PLAN.md](ADMIN_SAAS_PLAN.md)`             | Admin A0–A6 + O1+                      |
| `[docs/data-pipeline.md](data-pipeline.md)`            | Classify / analytics pipeline          |


