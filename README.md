# Aide — AI Customer Support & Customer Insights

Next.js fullstack MVP: build an agent, add knowledge, chat, customize webchat, embed on a site, and read analytics.

**Production:** [https://ai-customer-support-agent-ashen.vercel.app](https://ai-customer-support-agent-ashen.vercel.app)

## Stack

- **Next.js 16** (App Router) · React 19 · Tailwind CSS 4 · shadcn/ui
- **Prisma 7** · **Neon PostgreSQL**
- **Auth.js (NextAuth v5)** · **OpenAI** · **Cloudinary**
- Hosting: **always-on Node.js app server** (Node **22+**); the same server hosts Next.js and Socket.IO

## Local setup

```bash
git clone <this-repo>
cd AI-Customer-Support-Agent
npm install
cp .env.example .env
# fill env — never commit .env
npx prisma generate
npx prisma migrate deploy
npm run seed:admins
npm run dev
```

- App: http://localhost:3000 — `/register`, `/login`
- Admin: same `/login` with bootstrap **email + password** (no `/admin/register`)
- Health: `/api/health`

Copy variable names from `.env.example`. Required: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `OPENAI_API_KEY`. Optional: Cloudinary, Google, `LOG_LEVEL`. Admins are seeded from `prisma/admins.local.json`, not from `.env`.

## Node production deployment

1. Deploy the repository to an always-on Node host/container with Node **22.x**.
2. Start it with `npm run start`; `server.js` serves Next.js and Socket.IO on the same `PORT`.
3. Set `AUTH_URL` / `NEXT_PUBLIC_APP_URL` to the HTTPS app origin. `REALTIME_URL` is optional and defaults to the same origin.
4. Set the realtime Redis/secret variables from `.env.example` and run `npx prisma migrate deploy` against production Neon.
5. Seed admins once: copy `prisma/admins.local.example.json` → `prisma/admins.local.json`, fill 1–3 operators, `npm run seed:admins` against prod Neon. Delete the local file after.

Vercel remains suitable for an HTTP-only deployment, but it is not the target
runtime for this one-port Socket.IO architecture because it does not provide a
long-lived Node process for WebSocket connections.

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

## Seed platform admins (not in `.env`)

Admin passwords do **not** live in Vercel env. If `.env` leaks, rotate `AUTH_SECRET`, DB, OpenAI, SafePay, Resend, Cloudinary — not an admin password that was never there.

```bash
cp prisma/admins.local.example.json prisma/admins.local.json
# edit 1–3 emails + passwords (min 10 chars)
npx prisma migrate deploy
npm run seed:admins
rm prisma/admins.local.json
```

`prisma/admins.local.json` is gitignored. Seed upserts those users as `ADMIN` (password login only; Google blocked) and writes their emails to `PlatformSettings.reservedAdminEmail` so register/Google cannot claim them. Non-admin hitting `/admin` → 404.

**Production:** run seed on a laptop (or a one-shot CI job) pointed at **prod** `DATABASE_URL`. Do not put `ADMIN_BOOTSTRAP_PASSWORD` on Vercel.

**Console denseness (F07):** Users filters live in the URL; Requests shows a pending badge; Dashboard KPIs deep-link to Users / Suspended / Requests; agent inspect shows last chat without loading full knowledge bodies.

## Embed

Agent → **Customization** → **Deploy** — copy the snippet (`embed.js` + `data-aide-key`). Legacy `data-hapy-key` still works. First load on a new origin locks that site and queues a website crawl.

Agent → **Knowledge** — set **Website re-crawl schedule** (once / daily / weekly / etc.). When due, the next widget visit refreshes website knowledge automatically.

## Product map

| Area | Where |
|------|--------|
| Auth | `/login`, `/register` |
| Agents / knowledge / chat | `/agents`, `/agents/[id]/…` |
| Human desk | `/inbox` |
| Analytics | `/analytics` |
| Public webchat | `/w/[publicKey]` |
| Admin | `/admin` |

## Main API (presentation)

| Method | Path | Role |
|--------|------|------|
| `POST` | `/api/auth/register` | Sign up |
| Session | Auth.js (NextAuth v5) | Login / logout |
| CRUD | `/api/agents`, knowledge, chat | Owner console |
| `POST` | `/api/public/agents/[publicKey]/chat` | Embed chat |
| `GET` | `/api/public/agents/[publicKey]/ping` | Embed health |
| `GET` | `/api/analytics/*` | Insights |
| `GET` | `/api/health` | DB + app health |
| Desk | `/api/inbox/*`, conversations | Human handoff |
| Actions | `/api/agents/[id]/actions*` | Allowlisted tools |

## Data science (what we do today)

| Piece | Approach |
|-------|----------|
| Classification | LLM category labels after reply (F09) |
| Sentiment | POSITIVE / NEUTRAL / NEGATIVE on conversation |
| Insights | Aggregates on `/analytics` (topics, trends, KPIs) |
| Knowledge retrieve | F08 lexical + fuzzy ranking (**not** vector RAG yet) |

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
| [`docs/OPEN_SEQUENCE.md`](docs/OPEN_SEQUENCE.md) | Ordered remaining work |
| [`docs/ROADMAP_NEXT.md`](docs/ROADMAP_NEXT.md) | Roadmap index + OOS |
| [`docs/features/F00_DOD_DEMO_BUFFER.md`](docs/features/F00_DOD_DEMO_BUFFER.md) | DoD / demo buffer |
| [`docs/shipped/F00_PROGRESS.md`](docs/shipped/F00_PROGRESS.md) | Buffer checklist ticks |
| [`docs/SHIPPED_FEATURES.md`](docs/SHIPPED_FEATURES.md) | What shipped (F01–F12 + F11 UX) |
| [`docs/shipped/F11_AGENT_ACTIONS.md`](docs/shipped/F11_AGENT_ACTIONS.md) | Agent actions + UX-1–4 ✅ |
| [`docs/shipped/F13_TOOLS_HUB.md`](docs/shipped/F13_TOOLS_HUB.md) | Next build — Tools hub |
| [`docs/shipped/F14_END_USER_AUTH_AND_ACTION_CONSENT.md`](docs/shipped/F14_END_USER_AUTH_AND_ACTION_CONSENT.md) | In-chat consent plan |
| [`docs/features/`](docs/features/) | Plans F10–F14 |
| [`docs/ui/UI_STRATEGY.md`](docs/ui/UI_STRATEGY.md) | ShadCN polish guidance |
| [`docs/POST_MVP_BACKLOG_PLAN.md`](docs/POST_MVP_BACKLOG_PLAN.md) | Backlog |
| Internship `.docx` + audits | Under `docs/` |

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run seed:admins` | Create/update 1–3 admins from `prisma/admins.local.json` |
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
| `npm run test:f11` | F11 agent actions (A–H) |
| `npm run test:f11r` | F11 redesign R1–R5 |
| `npm run test:f11-ux2` · `ux3` · `ux4` | F11 Actions UX smokes |
| `npm run test:f12` | F12 human desk |
| `npm run test:shipped` | Full F01–F12 + crawl schedule smoke |
| `npm run bench:f02b` | Latency baselines |
| `npm run load:f02h` | Concurrent chat + analytics cold (needs server) |

## CI

PRs: **Lint** always (red = cannot merge once branch protection is on). **Shipped smoke** (`npm run test:shipped` — F01–F12 + crawl schedule) always runs without secrets. **HTTP smoke** (`test:product`, `test:bugfix`, optional `test:admin`) runs only when GitHub secrets are set; missing secrets → explicit skip (still green). When secrets *are* set, a failing smoke **fails the job**.

| Secret | Used for |
|--------|----------|
| `TEST_BASE_URL` | Prefer a **Vercel preview** URL (not localhost) for merge gates |
| `DATABASE_URL` | Product smoke cleanup (delete temp users) |
| `OPENAI_API_KEY` | One FAQ chat in product smoke |
| `ADMIN_BOOTSTRAP_EMAIL` | Optional HTTP admin smoke only (not required on Vercel) |
| `ADMIN_BOOTSTRAP_PASSWORD` | Optional HTTP admin smoke only (not required on Vercel) |

**Branch protection:** require the **Lint** check; also require **HTTP smoke** once the secrets above are configured.

**Release / preview:** run `npx prisma migrate deploy` against Neon (`DIRECT_URL`) before or with prod promote — never `prisma migrate dev` on Vercel. For preview deploys, set `AUTH_URL` and `NEXT_PUBLIC_APP_URL` to the preview host.
