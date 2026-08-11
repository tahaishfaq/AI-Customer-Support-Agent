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

- [x] Register / login / logout / me
- [x] JWT + bcrypt
- [x] Google route (`POST /api/auth/google`)
- [x] httpOnly cookie `hapy_token` (set on login/register/google, clear on logout)

## Phase 1 Frontend status

- [x] Landing page
- [x] Login / Register + Google button
- [x] Dashboard shell + logout
- [x] Cookie-based session (`credentials: "include"`)

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
