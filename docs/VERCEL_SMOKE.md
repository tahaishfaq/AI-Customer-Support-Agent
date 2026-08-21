# Production / Vercel smoke (P0-2)

Ran against live HTTPS on **2026-08-20** by agent (`scripts/prod-smoke.mjs` + `scripts/p0-2-vercel-smoke.mjs`).

Base URL: `https://ai-customer-support-agent-ashen.vercel.app`  
Date: 2026-08-20  
Tester: Cursor agent (API smoke, not Vercel dashboard)

## Product

- [x] `AUTH_URL` / `NEXT_PUBLIC_APP_URL` HTTPS, no trailing slash — live origin is HTTPS, no trailing slash; `/login` 200 over HTTP/2
- [x] Production DB reachable — `GET /api/health` → `"database":"ok"` (did not run `migrate deploy` from this machine; live APIs including unique embed origin work)
- [x] User A: two workspaces; agent only in W1; switch to W2; `/api/agents` does not list W1 agents; W1 agent API 404
- [x] User B cannot open User A agent API (403)
- [x] Widget `/w/{publicKey}` 200; ping locks origin; second agent ping `ok: false` (cannot steal)
- [x] Chat + classify persist (`SUPPORT`/`NEUTRAL`); `/api/analytics/dashboard` totalConversations ≥ 1

## Admin

- [x] USER hitting `/admin` → 404 (also anon 404)
- [ ] ADMIN email/password → `/admin` → Users → workspace → agent → transcript — **FAIL:** `ADMIN_BOOTSTRAP_*` on this laptop did not create an ADMIN session on Vercel (different password or admin never seeded on that deploy)
- [ ] Suspend / embed kill / export JSON / cannot delete last admin — **blocked** until live ADMIN login works

`scripts/prod-smoke.mjs` against the same URL: **0 failed** (register, PDF, chat, analytics, widget).
