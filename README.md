# Hapy — AI Customer Support & Customer Insights

Next.js fullstack MVP: build an agent, add knowledge, chat, customize webchat, embed on a site, and read analytics.

**Production:** [https://ai-customer-support-agent-ashen.vercel.app](https://ai-customer-support-agent-ashen.vercel.app)

## Stack

- **Next.js 16** (App Router) · React 19 · Tailwind CSS 4 · shadcn/ui
- **Prisma 7** · **Neon PostgreSQL**
- **Auth.js (NextAuth v5)** · **OpenAI** · **Cloudinary** · **unpdf**
- JavaScript (`.js` / `.jsx`)
- Hosting: **Vercel** (Node **22+**)

## Local setup

```bash
npm install
cp .env.example .env
# fill Neon, AUTH_SECRET, OPENAI, Cloudinary, Google client IDs
npx prisma generate
npx prisma migrate deploy   # production / first clone
# npx prisma migrate dev    # local schema changes
npm run dev
```

- App: http://localhost:3000
- Health: http://localhost:3000/api/health — `{ "status": "ok", "database": "ok" }`

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

3. After first deploy: `npx prisma migrate deploy` against production Neon (or run it from a machine with `DIRECT_URL`).
4. Google Cloud: add the Vercel origin to authorized JavaScript origins.

`postinstall` runs `prisma generate`. Do not commit `.env`.

## Embed (live widget)

From **Agent → Customization → Deploy** (or Share), copy the snippet. On your marketing site:

```html
<script
  src="https://ai-customer-support-agent-ashen.vercel.app/embed.js?v=3"
  data-hapy-key="YOUR_PUBLIC_KEY"
  defer
></script>
```

First load of the widget on a new origin queues a **one-time** crawl of that origin into WEB knowledge (not a daily recrawl).

Public chat is rate-limited (~20 messages / minute / IP).

## Product map

| Area | Where |
|------|--------|
| Agents | `/agents` |
| Knowledge (TEXT / PDF / WEB) | `/agents/[id]/knowledge` |
| Conversations (per agent) | `/agents/[id]/conversations` |
| Customization | `/agents/[id]/customization` |
| Studio test | `/agents/[id]/test` |
| Analytics | `/analytics` and `/agents/[id]/analytics` |
| Public webchat | `/w/[publicKey]` |

## Go-live smoke (after each deploy)

1. Register / login on the Vercel URL.
2. Create an agent → add TEXT knowledge → **Test** (optional auto-run pack).
3. Upload a real PDF on Knowledge.
4. Open **Conversations** on that agent — thread stays on this agent only.
5. Customization → copy embed → paste on a page → send one public chat.
6. `/api/health` returns `"database": "ok"`.
7. `/analytics` shows the new conversation.

## Docs

Canonical MVP plan: [`docs/NEXTJS_FULLSTACK_PLAN.md`](docs/NEXTJS_FULLSTACK_PLAN.md)

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Production build (what Vercel runs) |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | `prisma migrate dev` |
| `npm run prisma:studio` | Open Prisma Studio |
