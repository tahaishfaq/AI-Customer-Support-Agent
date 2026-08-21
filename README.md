# Hapy — AI Customer Support & Customer Insights

Next.js fullstack MVP: build an agent, add knowledge, chat, customize webchat, embed on a site, and read analytics.

**Production:** [https://ai-customer-support-agent-ashen.vercel.app](https://ai-customer-support-agent-ashen.vercel.app)

## Stack

- **Next.js 16** (App Router) · React 19 · Tailwind CSS 4 · shadcn/ui
- **Prisma 7** · **Neon PostgreSQL**
- **Auth.js (NextAuth v5)** · **OpenAI** · **Cloudinary** · **unpdf**
- JavaScript (`.js` / `.jsx`)
- Hosting: **Vercel** (Node **22+**)

## Local setup (clone → run)

```bash
git clone <this-repo>
cd AI-Customer-Support-Agent
npm install
cp .env.example .env
# fill the env table below — never commit .env
npx prisma generate
npx prisma migrate deploy
npm run seed:admin    # once: creates the single ADMIN from ADMIN_BOOTSTRAP_*
npm run dev
```

- App: http://localhost:3000 — register at `/register`, sign in at `/login`
- Admin: same `/login` with the bootstrap **email + password**. There is **no** `/admin/register`.
- Health: http://localhost:3000/api/health — `{ "status": "ok", "database": "ok" }`
- 5-minute slides (browser): http://localhost:3000/demo-slides.html
- Intern sign-off (process): [`docs/INTERN_REVIEW_CHECKLIST.md`](docs/INTERN_REVIEW_CHECKLIST.md)

### Env (copy names from `.env.example`)

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes | Neon **pooled** |
| `DIRECT_URL` | Yes | Neon **direct** (migrations) |
| `AUTH_SECRET` | Yes | `openssl rand -base64 32` |
| `AUTH_URL` | Yes | `http://localhost:3000` locally; HTTPS origin in production, no trailing slash |
| `NEXT_PUBLIC_APP_URL` | Yes | Same origin as the app |
| `OPENAI_API_KEY` | Yes | Chat, classify, test questions |
| `CLOUDINARY_CLOUD_NAME` / `API_KEY` / `API_SECRET` | For PDFs | TEXT knowledge works without this |
| `GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | For GIS | Same client ID; leave empty to hide Google |
| `ADMIN_BOOTSTRAP_EMAIL` / `PASSWORD` | For admin | Then `npm run seed:admin` |
| `TEST_BASE_URL` | CI only | Optional; see CI below |

### Workspaces

After login, the product is **one active workspace**. Create extra workspaces from the dashboard switcher. Agents, knowledge, chats, and analytics stay inside the active workspace. Switching workspaces hides the other workspace’s agents (direct URL → 404).

### Prisma migrations

Apply with `npx prisma migrate deploy` (clone / production) or `npm run prisma:migrate` (local schema edits). Folders under `prisma/migrations/`:

`20260811180000_init` · NextAuth tables · Google fields · Cloudinary PDF · customization · workspaces · embed/crawl · WEB knowledge · message feedback · user role admin · audit/last login · agent enabled · restore request · restore decision · platform settings · single admin email · unique embed origin.

## Vercel (production)

1. Connect this GitHub repo. Framework: Next.js. Node.js **22.x**.
2. Set env vars (same names as `.env.example`):

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Neon **pooled** URL |
| `DIRECT_URL` | Neon **direct** (migrations) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | `https://YOUR-APP.vercel.app` (HTTPS, no trailing slash) |
| `NEXT_PUBLIC_APP_URL` | Same production origin |
| `GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | GIS button |
| `OPENAI_API_KEY` | Chat + classify + test questions |
| `CLOUDINARY_*` | PDF + avatars |
| `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` | Seed the **one** platform admin (`npm run seed:admin`) |

3. After first deploy: `npx prisma migrate deploy` against production Neon (or run it from a machine with `DIRECT_URL`).
4. Google Cloud: add the Vercel origin to authorized JavaScript origins.

`postinstall` runs `prisma generate`. Do not commit `.env`.

## Seed the one admin (A0)

There is **no** `/admin/register`. Create the operator from env:

```bash
# .env
ADMIN_BOOTSTRAP_EMAIL=you@example.com
ADMIN_BOOTSTRAP_PASSWORD=at-least-10-chars
npm run seed:admin
```

Sign in at `/login` with the operator **email and password** (Google cannot sign in as admin). `ADMIN_BOOTSTRAP_EMAIL` cannot be used on `/register` or Google. User emails stay unique; there can be only one `ADMIN` row. Visiting `/admin` without an admin session returns 404.

**Legal (A6):** `/admin/audit` is the inspect log. On a user detail page, **Export** downloads JSON (all workspaces, agents, knowledge, chats). **Delete** requires typing that user’s email; the platform admin cannot be deleted.

Product `/api/agents` stays workspace-scoped even when the session is ADMIN.

## Embed (live widget)

From **Agent → Customization → Deploy** (or Share), copy the snippet. On your marketing site:

```html
<script
  src="https://ai-customer-support-agent-ashen.vercel.app/embed.js?v=6"
  data-hapy-key="YOUR_PUBLIC_KEY"
  defer
></script>
```

First load of the widget on a new origin queues a **one-time** crawl of that origin into WEB knowledge (not a daily recrawl).

Public chat is rate-limited (~20 messages / minute / IP).

## Product map

| Area | Where |
|------|--------|
| Login / register | `/login`, `/register` (admin also uses `/login` only) |
| Workspaces | Dashboard switcher |
| Agents | `/agents` |
| Knowledge (TEXT / PDF / WEB) | `/agents/[id]/knowledge` |
| Conversations (per agent) | `/agents/[id]/conversations` |
| Customization / embed snippet | `/agents/[id]/customization` |
| Studio test | `/agents/[id]/test` |
| Analytics | `/analytics` and `/agents/[id]/analytics` |
| Public webchat | `/w/[publicKey]` |
| Admin console | `/admin` (ADMIN session; others get 404) |

## 5-minute demo slides

**Yeh slides README tables nahi — browser deck hai:**

**http://localhost:3000/demo-slides.html**

(`npm run dev` chalu ho.) Arrow keys / Next · **F** fullscreen. App doosri tab mein rakho.

Speaker notes (Do this / Say this) README ke neeche bhi hain. Full deck: [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md)

---

### Slide 1 — Problem

| | |
|---|---|
| **Time** | ~30s |
| **Do this** | Landing `/` or, if already signed in, `/dashboard`. Do not click around yet. |
| **Say this** | Small sites need 24/7 answers (refunds, hours) without a helpdesk team. Hapy is a **workspace-scoped** support agent: knowledge in, chat out, then **insights** on what people asked. |

---

### Slide 2 — Sign in

| | |
|---|---|
| **Time** | ~20s |
| **Do this** | Open `/login`. Point at email + password (Google if the button loaded). Mention `/register` for a new user. |
| **Say this** | Customers sign in here. The **one admin** uses the **same** `/login` with email/password. There is **no** `/admin/register`. Google cannot sign in as admin. |

---

### Slide 3 — Workspace + agent

| | |
|---|---|
| **Time** | ~40s |
| **Do this** | After login, sidebar **Workspace** (one active). Click **+ New agent**. Fill name, system prompt, welcome. **Create agent**. |
| **Say this** | Everything lives in the **active** workspace. A second workspace would **not** list this agent (direct URL → 404). |

---

### Slide 4 — Knowledge

| | |
|---|---|
| **Time** | ~40s |
| **Do this** | Agent → **Knowledge** → **Add Text / FAQ**. Name e.g. Refunds FAQ. Q: *How long do refunds take?* A: *Refunds are processed within 5 business days.* **Add knowledge**. |
| **Say this** | This is what the model may use. PDF upload is optional if Cloudinary is set. |

---

### Slide 5 — Studio chat

| | |
|---|---|
| **Time** | ~50s |
| **Do this** | **Test** tab. In the widget, type the refund question → Send. Then open **Conversations**. |
| **Say this** | Reply should cite the FAQ (5 business days). Inbox shows **this agent only** — USER + ASSISTANT, not a playground that disappears. |

---

### Slide 6 — Analytics

| | |
|---|---|
| **Time** | ~40s |
| **Do this** | Same agent → **Analytics**, or sidebar **Analytics**. |
| **Say this** | Conversation count, topic, sentiment come from classify. Week 2: chats are **stored and labeled**. |

---

### Slide 7 — Embed + origin lock

| | |
|---|---|
| **Time** | ~40s |
| **Do this** | **Customization** → **Deploy**. Point at the snippet (`embed.js` + `data-hapy-key`). Copy is enough — do not paste on a random live site in the talk unless you own it. |
| **Say this** | First load on a new origin **locks** that site and queues a **one-time** crawl. A second agent cannot steal that origin. |

---

### Slide 8 — Admin inspect *(optional)*

| | |
|---|---|
| **Time** | ~60s |
| **Do this** | Sign out (or a second browser). `/login` as admin. Open `/admin`. Users → workspace → agent → transcript. As a normal user, `/admin` is **404**. |
| **Say this** | One operator. No impersonation in this MVP. Skip this slide if you are short on time. |

---

### Slide 9 — Clone + what we did not build

| | |
|---|---|
| **Time** | ~20s |
| **Do this** | Stay on this README. Point at **Local setup** and `.env.example`. |
| **Say this** | Stranger path: copy env → `migrate deploy` → `seed:admin` → `npm run dev`. With the app up: `npm run test:product`. Out of scope: billing, vector RAG, extra channels — named in `docs/POST_MVP_BACKLOG_PLAN.md`. |

---

## Go-live smoke (after each deploy)

1. Register / login on the Vercel URL.
2. Create an agent → add TEXT knowledge → **Test** (optional auto-run pack).
3. Upload a real PDF on Knowledge.
4. Open **Conversations** on that agent — thread stays on this agent only.
5. Customization → copy embed → paste on a page → send one public chat.
6. `/api/health` returns `"database": "ok"`.
7. `/analytics` shows the new conversation.

## Docs

Canonical MVP plan: [`docs/NEXTJS_FULLSTACK_PLAN.md`](docs/NEXTJS_FULLSTACK_PLAN.md) · Admin: [`docs/ADMIN_SAAS_PLAN.md`](docs/ADMIN_SAAS_PLAN.md) · Backlog: [`docs/POST_MVP_BACKLOG_PLAN.md`](docs/POST_MVP_BACKLOG_PLAN.md) · Vercel smoke: [`docs/VERCEL_SMOKE.md`](docs/VERCEL_SMOKE.md) · Competitor audits: [`docs/AUDIT_ZENDESK_VS_HAPY.md`](docs/AUDIT_ZENDESK_VS_HAPY.md) · [`docs/AUDIT_INTERCOM_VS_HAPY.md`](docs/AUDIT_INTERCOM_VS_HAPY.md) · [`docs/AUDIT_BOTPRESS_VS_HAPY.md`](docs/AUDIT_BOTPRESS_VS_HAPY.md) · Fusion: [`docs/FUSION_PLAN_HAPY_UNIQUE.md`](docs/FUSION_PLAN_HAPY_UNIQUE.md)

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Production build (what Vercel runs) |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | `prisma migrate dev` |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run seed:admin` | Create the one platform admin |
| `npm run test:product` | Product API smoke (`npm run dev` + OpenAI) |
| `npm run test:admin` | Admin A0 + v1 tests (dev server + DB + admin seed) |

## CI

PRs run `.github/workflows/ci.yml`: **lint always**. HTTP smoke (`test:product`, then `test:admin`) runs only when these GitHub repo secrets exist:

- `TEST_BASE_URL` — live app origin, no trailing slash (preview or production)
- `DATABASE_URL` — same Neon as that app (cleanup + A0 checks)
- `OPENAI_API_KEY` — needed for studio chat
- `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD` — required for `test:admin` only

If those secrets are missing, the smoke job **skips and still passes** (documented skip). After secrets are set, a failing smoke **fails the PR**. Branch protection (require “Lint”) is up to the repo admin.

Local: `npm run dev`, then `npm run test:product`. Signups must be open.
