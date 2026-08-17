# Hapy — AI Customer Support & Customer Insights

Next.js fullstack MVP (UI + API in one app).

## Stack

- **Next.js 16** (App Router) · React 19 · Tailwind CSS 4 · shadcn/ui
- **Prisma 7** · **Neon PostgreSQL**
- JavaScript (`.js` / `.jsx`)

## Phase 0 status

- [x] Next.js app runs
- [x] Prisma schema (User → Agent → Knowledge / Conversations → Messages)
- [x] `lib/prisma.js` + `.env.example`
- [x] `GET /api/health`
- [x] Global CSS colors + fonts
- [x] shadcn/ui base components
- [x] Neon migrate applied

## Phase 1 Backend status

- [x] Register (`POST /api/auth/register`) + bcrypt passwords
- [x] **Auth.js (NextAuth v5)** session (Credentials + Google id-token)
- [x] `GET /api/auth/me` from NextAuth session
- [x] DIY JWT / `hapy_token` removed

## Phase 1 Frontend status

- [x] Landing page
- [x] Login / Register + Google button (`signIn`)
- [x] Dashboard shell + logout (`signOut`)
- [x] NextAuth `SessionProvider` + cookie session (`credentials: "include"`)

## Phase 2 Backend status

- [x] Agents CRUD APIs
- [x] `GET /api/analytics/overview`
- [x] Protected with NextAuth `auth()` / `requireAuth`

## Setup

### 1. Install

```bash
npm install
```

### 2. Neon database

1. Create a project at [console.neon.tech](https://console.neon.tech)
2. Copy **pooled** connection → `DATABASE_URL` in `.env`
3. Copy **direct** (non-pooler) connection → `DIRECT_URL` in `.env`

```bash
cp .env.example .env
# edit .env with your Neon URLs
```

### 3. Migrate

```bash
npx prisma generate
npx prisma migrate deploy
# or during local development:
npx prisma migrate dev
```

### 4. Run

```bash
npm run dev
```

- App: http://localhost:3000  
- Health: http://localhost:3000/api/health  

Expected health response:

```json
{
  "status": "ok",
  "service": "hapy-api",
  "timestamp": "..."
}
```

## Project docs (parent folder)

Plans and API contract live in the sibling `docs/` folder of the parent workspace:

- `NEXTJS_FULLSTACK_PLAN.md` — full phase plan
- `api-contract.md` — API shapes

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run prisma:generate` | Generate Prisma Client |
| `npm run prisma:migrate` | Create/apply migrations |
| `npm run prisma:studio` | Open Prisma Studio |
