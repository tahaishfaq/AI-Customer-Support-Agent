# Hapy — AI Customer Support & Customer Insights

Next.js fullstack MVP: build an agent, add knowledge, chat, customize webchat, embed on a site, and read analytics.

**Production:** [https://ai-customer-support-agent-ashen.vercel.app](https://ai-customer-support-agent-ashen.vercel.app)

## Stack

- **Next.js 16** (App Router) · React 19 · Tailwind CSS 4 · shadcn/ui
- **Prisma 7** · **Neon PostgreSQL**
- **Auth.js (NextAuth v5)** · **OpenAI** · **Cloudinary**
- Hosting: **Vercel** (Node **22+**)

## Local setup

```bash
git clone <this-repo>
cd AI-Customer-Support-Agent
npm install
cp .env.example .env
# fill env — never commit .env
npx prisma generate
npx prisma migrate deploy
npm run seed:admin
npm run dev
```

- App: http://localhost:3000 — `/register`, `/login`
- Admin: same `/login` with bootstrap **email + password** (no `/admin/register`)
- Health: `/api/health`

Copy variable names from `.env.example`. Required: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `OPENAI_API_KEY`. Optional: Cloudinary, Google, `LOG_LEVEL`, admin bootstrap (`ADMIN_BOOTSTRAP_*` + `seed:admin`).

## Vercel

1. Connect the repo · Node **22.x**
2. Set the same env vars as `.env.example` (`AUTH_URL` / `NEXT_PUBLIC_APP_URL` = your HTTPS origin)
3. `npx prisma migrate deploy` against production Neon
4. Seed admin once: `npm run seed:admin`

### Logs

API responses include **`x-request-id`**. Failures log JSON with that id (no chat transcripts). In Vercel → **Logs**, search the header value or codes like `LLM_FAILED` / `CRAWL_FAILED`. Optional: `LOG_LEVEL=warn|error`. See [`docs/SHIPPED_FEATURES.md`](docs/SHIPPED_FEATURES.md) (F01).

### Neon (pooler vs direct)

| URL | Use |
|-----|-----|
| `DATABASE_URL` | App / Prisma Client — Neon **pooled** host (`-pooler` in hostname) |
| `DIRECT_URL` | `prisma migrate` only — **non-pooler** direct host |

Keep `PG_POOL_MAX` small (default 3) per serverless instance. See F02 Phase G.

### Vercel function budget

Chat routes set `maxDuration = 60`. Keep `OPENAI_TIMEOUT_MS` (default 45000) **under** that so the function does not die mid-reply. Analytics timeouts use `ANALYTICS_TIMEOUT_MS` (default 15s).

### Rate limits

In-memory per instance (`lib/rate-limit.js`). Tune via `RATE_LIMIT_PUB_CHAT`, `RATE_LIMIT_STUDIO_CHAT`, etc. **Upstash Redis:** deferred until multi-instance 429 drift hurts (F02-G decision: not yet).

## Seed the one admin

```bash
ADMIN_BOOTSTRAP_EMAIL=you@example.com
ADMIN_BOOTSTRAP_PASSWORD=at-least-10-chars
npm run seed:admin
```

One platform admin. Google cannot sign in as admin. Non-admin hitting `/admin` → 404.

**Console denseness (F07):** Users filters live in the URL; Requests shows a pending badge; Dashboard KPIs deep-link to Users / Suspended / Requests; agent inspect shows last chat without loading full knowledge bodies.

**Production:** point `DATABASE_URL` at the **same Neon** the Vercel app uses, then run `npm run seed:admin` once (local machine or CI with prod URL). Seed also writes `PlatformSettings.reservedAdminEmail` so a missing `ADMIN_BOOTSTRAP_EMAIL` on a future deploy cannot reopen Google signup for that address. After seed, keep `ADMIN_BOOTSTRAP_*` set on Vercel for smokes and reclaim.

## Embed

Agent → **Customization** → **Deploy** — copy the snippet (`embed.js` + `data-hapy-key`). First load on a new origin locks that site and queues a website crawl.

Agent → **Knowledge** — set **Website re-crawl schedule** (once / daily / weekly / etc.). When due, the next widget visit refreshes website knowledge automatically.

## Product map

| Area | Where |
|------|--------|
| Auth | `/login`, `/register` |
| Agents / knowledge / chat | `/agents`, `/agents/[id]/…` |
| Analytics | `/analytics` |
| Public webchat | `/w/[publicKey]` |
| Admin | `/admin` |

## Go-live smoke

1. Login → create agent → TEXT knowledge → Test chat  
2. Conversations + Analytics update  
3. `/api/health` → `"database": "ok"`  
4. Embed once on an allowed origin (site you own)  
5. Admin email/password → `/admin` loads  
6. Normal USER → `/admin` = **404**  
7. Optional: `TEST_BASE_URL=<live> npm run test:product`  

## Docs

| File | Role |
|------|------|
| [`docs/ROADMAP_NEXT.md`](docs/ROADMAP_NEXT.md) | What to do next (F00 → F11 · OOS later) |
| [`docs/features/F00_DOD_DEMO_BUFFER.md`](docs/features/F00_DOD_DEMO_BUFFER.md) | DoD / demo buffer (do first) |
| [`docs/SHIPPED_FEATURES.md`](docs/SHIPPED_FEATURES.md) | Simple summary — kyun add kiya, kya improve hua (F01–F09) |
| [`docs/features/`](docs/features/) | Future plans F10–F12 |
| [`docs/POST_MVP_BACKLOG_PLAN.md`](docs/POST_MVP_BACKLOG_PLAN.md) | Backlog |
| Internship `.docx` + audits | Under `docs/` |

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run seed:admin` | Create the one admin |
| `npm run test:product` | Product API smoke |
| `npm run test:admin` | Admin smoke |
| `npm run test:bugfix` | Origin lock + security HTTP regression |
| `npm run test:f01` | F01 observability smokes |
| `npm run test:f02` | F02 A–H contract smokes |
| `npm run test:f03` | F03 CI / smoke contract |
| `npm run test:f04` | F04 design identity A–H |
| `npm run test:f05` | F05 agent test studio |
| `npm run test:f06` | F06 admin security |
| `npm run test:f07` | F07 admin platform |
| `npm run test:f08a` | F08-A knowledge retrieval scope |
| `npm run test:f08b` | F08-B chunk / score / select |
| `npm run test:f08c` | F08-C WEB boost / dedupe |
| `npm run test:f08d` | F08-D empty KB / large-doc hint |
| `npm run test:f08e` | F08-E retrieve caps |
| `npm run test:f08` | F08 A–H knowledge retrieval |
| `npm run test:f09` | F09 A–H prompts & guidance |
| `npm run test:crawl-schedule` | Scheduled website re-crawl |
| `npm run test:shipped` | Full F01–F09 + crawl schedule smoke |
| `npm run bench:f02b` | Latency baselines |
| `npm run load:f02h` | Concurrent chat + analytics cold (needs server) |

## CI

PRs: **Lint** always (red = cannot merge once branch protection is on). **Shipped smoke** (`npm run test:shipped` — F01–F09 + crawl schedule) always runs without secrets. **HTTP smoke** (`test:product`, `test:bugfix`, optional `test:admin`) runs only when GitHub secrets are set; missing secrets → explicit skip (still green). When secrets *are* set, a failing smoke **fails the job**.

| Secret | Used for |
|--------|----------|
| `TEST_BASE_URL` | Prefer a **Vercel preview** URL (not localhost) for merge gates |
| `DATABASE_URL` | Product smoke cleanup (delete temp users) |
| `OPENAI_API_KEY` | One FAQ chat in product smoke |
| `ADMIN_BOOTSTRAP_EMAIL` | Admin smoke + reserved-email register check |
| `ADMIN_BOOTSTRAP_PASSWORD` | Admin smoke |

**Branch protection:** require the **Lint** check; also require **HTTP smoke** once the secrets above are configured.

**Release / preview:** run `npx prisma migrate deploy` against Neon (`DIRECT_URL`) before or with prod promote — never `prisma migrate dev` on Vercel. For preview deploys, set `AUTH_URL` and `NEXT_PUBLIC_APP_URL` to the preview host.
