# Guide: Local browser crawl (shared Neon DB → coral)

**When to use:** Brandly (or any JS SPA) fails on coral because Vercel has no Chromium. You crawl **locally** with Playwright; knowledge is saved in **Postgres**. If local and coral use the **same Neon `DATABASE_URL`**, coral Studio/embed see that knowledge immediately — no coral crawl needed.

**Not the same as:** publishing static HTML on Brandly (that plan is separate: `docs/features/BRANDLY_STATIC_HTML_CRAWL_PLAN.md`).

---

## 0) Prerequisite — same database

This trick **only** works if:

| Environment | Must share |
|-------------|------------|
| Local `.env` `DATABASE_URL` | Neon pooled URL (same project as coral) |
| Coral Vercel env `DATABASE_URL` | **Identical** Neon DB |

Check (compare **hosts / db name only** — do not paste passwords in chat):

1. Local: open `.env` → note Neon host (e.g. `ep-….neon.tech`) and database name.
2. Vercel → Project (coral) → Settings → Environment Variables → `DATABASE_URL` → same host + db.

If local uses a different Neon branch / local Postgres, crawled docs stay local-only. Then either point local at coral’s Neon, or use static HTML / upload instead.

`DIRECT_URL` should be the same Neon project’s direct (non-pooler) URL for migrations; crawl itself uses the app DB via Prisma (`DATABASE_URL`).

---

## 1) Enable browser crawl in local `.env`

In Aide repo root `.env`:

```bash
CRAWL_BROWSER_ENABLED=1
```

Accepted values: `1`, `true`, `yes`, `on` (see `lib/services/site-crawler-browser.js`).

Restart the app after changing env (`npm run dev` stop/start). Env is read at process start.

Optional (already in Docker; local usually fine without):

```bash
# Only if Playwright browsers are installed to a custom path
# PLAYWRIGHT_BROWSERS_PATH=/path/to/ms-playwright
```

---

## 2) Install Chromium for Playwright

From Aide repo root (Node 22+):

```bash
cd "/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent"

# Dependencies (if needed)
npm install

# Install Chromium used by crawl (same family as package.json playwright 1.63.x)
npx playwright install chromium
```

On macOS, if launch fails with missing OS deps:

```bash
npx playwright install --with-deps chromium
```

Quick sanity check:

```bash
node -e "const { chromium } = require('playwright'); chromium.launch({ headless: true }).then(b => b.close()).then(() => console.log('chromium ok'))"
```

If this errors, fix Playwright install before crawling.

---

## 3) Run Aide locally

Prefer the real app server (Next + jobs), not a random preview:

```bash
npm run dev
```

Open Studio (usually `http://localhost:3000`) and **log in as the same user/workspace** that owns the coral agent (same Neon → same accounts).

Confirm you open the **same agent** you use on coral (same agent id / name). Knowledge is per-agent.

---

## 4) Queue Brandly crawl

1. Go to **Agents → [your Brandly agent] → Knowledge**.
2. In **Crawl / re-crawl website**, paste public https seeds (same domain), e.g.:

```text
https://brandly-five.vercel.app
https://brandly-five.vercel.app/help-center
https://brandly-five.vercel.app/features
https://brandly-five.vercel.app/solutions/for-brands
```

Tips:

- Only `https` (no localhost).
- All URLs same origin.
- Prefer marketing/help paths; skip `/login`, `/dashboard`, `/admin`.
- Brandly home is an SPA shell — with `CRAWL_BROWSER_ENABLED=1` the server should **render** pages and extract text.

3. Click **Re-crawl now**.
4. Wait until status is **DONE** (or **PARTIAL** with some WEB docs). Avoid clicking again while status is QUEUED/RUNNING (`CRAWL_IN_FLIGHT`).

If you see a message about “no browser” / `CRAWL_BROWSER_UNAVAILABLE`: Chromium install or env flag failed — fix steps 1–2 and restart `npm run dev`.

If crawl queues then fails with empty SPA text: confirm `CRAWL_BROWSER_ENABLED=1` is actually loaded (restart), and Brandly URL is reachable from your machine (not blocked by VPN / 403).

---

## 5) Verify knowledge on local Studio

On Knowledge list you should see **WEB** documents with `sourceUrl` like `https://brandly-five.vercel.app/...` and non-empty content preview.

**Test studio:** ask e.g. “How does Brandly escrow / payouts work?” — answer should cite knowledge (and Learn more / source chips if `sourceUrl` present).

---

## 6) Verify on coral (same DB)

1. Open https://ai-customer-support-agent-coral.vercel.app (or your coral URL).
2. Same account → same agent → **Knowledge**.
3. Same WEB docs should appear **without** re-crawling on coral.
4. Test studio / embed on Brandly with the **coral** public key for that agent.

Do **not** expect coral “Re-crawl now” to work for SPA until coral has Chromium (it usually does not). Local crawl + shared DB is the point.

---

## 7) Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Coral knowledge empty after local DONE | Different `DATABASE_URL` / Neon branch | Align local `.env` with Vercel coral `DATABASE_URL` |
| “Unable to retry website crawl” (500) | Job/worker error, Redis, or crash during crawl | Check local terminal logs for `CRAWL_` / Playwright errors; ensure `npm run dev` / `server.js` path that runs crawl `after()` |
| Browser disabled message | Flag off or Chromium missing | `CRAWL_BROWSER_ENABLED=1`, `npx playwright install chromium`, restart |
| Crawl DONE but thin/empty docs | SPA blocked remote, or render timeout | Try more specific Brandly URLs; check Brandly loads in your browser; retry |
| Wrong agent’s knowledge | Different agent id on local vs coral | Use same agent record (same Neon + same agent) |
| Rate limit | Too many retries | Wait a few minutes (`crawl-retry` rate limit) |

---

## 8) Security / ops notes

- Crawl only **public** pages. Do not seed authenticated app URLs with secrets in the query string.
- Local machine must be allowed to egress to Brandly and Neon.
- Turning `CRAWL_BROWSER_ENABLED=1` on **Vercel coral** alone is usually useless without Chromium in the serverless image — keep browser crawl on local or Render Docker.
- After a successful local crawl, coral redeploy is **not** required for knowledge to show (DB already updated).

---

## Checklist

- [ ] Local `DATABASE_URL` host/db matches coral Vercel
- [ ] `.env` has `CRAWL_BROWSER_ENABLED=1`
- [ ] `npx playwright install chromium` succeeds
- [ ] `npm run dev` restarted after env change
- [ ] Same agent as coral
- [ ] Re-crawl Brandly URLs → DONE
- [ ] Local Test studio grounded answer
- [ ] Coral Knowledge shows same WEB docs

---

## Commands cheat sheet

```bash
cd "/Users/samiafzal/Desktop/Hapy Ai support agent/AI-Customer-Support-Agent"

# .env
# CRAWL_BROWSER_ENABLED=1

npx playwright install chromium
npm run dev
# → Studio Knowledge → Re-crawl Brandly https URLs → wait DONE
# → Confirm on coral Knowledge (same Neon)
```
