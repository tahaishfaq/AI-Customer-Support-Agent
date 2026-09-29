# Plan: Brandly static HTML pages for Aide HTTP crawl

**Status:** ready to implement in the Brandly frontend repo (not Aide).  
**Goal:** Publish real HTML at `/help`, `/pricing`, `/faq` so Aide coral can crawl Brandly without browser/Chromium.  
**Owner agent:** implement in Brandly (`brandin`), deploy `brandly-five`, then verify crawl from Aide.

---

## Context (do not skip)

- Brandly (`brandin`) is **Create React App** + React Router. Live site: `https://brandly-five.vercel.app`.
- Aide’s crawler fetches **raw HTML** (no JS). CRA pages only ship `<div id="root"></div>` → crawl finds no text.
- Coral (Vercel Aide) typically has **no Chromium** / `CRAWL_BROWSER_ENABLED`, so SPA crawl will keep failing.
- Existing product copy lives in Brandly repo: `aide-brandly-knowledge.md` — reuse that content as HTML body text.
- Aide embed script is already in `public/index.html` with `data-aide-key` — do **not** break it; key may need updating separately (out of scope unless broken).

**Out of scope for this plan**

- Enabling browser crawl on Aide / Render Docker
- Changing Aide crawler code
- Rewriting Brandly to Next.js SSR
- Login/admin/dashboard pages

---

## Success criteria

1. `curl -sL https://brandly-five.vercel.app/help` returns HTML whose **body** contains readable help sentences (e.g. “escrow”, “payout”) — not only an empty `#root`.
2. Same for `/pricing` and `/faq`.
3. Browser **View Page Source** (not DevTools rendered DOM) shows that text.
4. Aide agent Knowledge → Re-crawl of those three URLs reaches **DONE** (or PARTIAL with at least one WEB doc with `sourceUrl` under `/help`, `/pricing`, or `/faq`).
5. Existing SPA routes (`/`, `/help-center`, dashboards) still work.

---

## Implementation (Brandly repo)

### Repo path

Primary local path (adjust if different on the machine):

`/Users/samiafzal/Desktop/FYP/03_Source_Code/FYP/brandin`

Confirm with `package.json` name / CRA `react-scripts` before editing.

### 1) Add static HTML under `public/`

Create directories and files (CRA copies `public/` → `build/` as-is):

| File | Public URL after deploy |
|------|-------------------------|
| `public/help/index.html` | `https://brandly-five.vercel.app/help` |
| `public/pricing/index.html` | `https://brandly-five.vercel.app/pricing` |
| `public/faq/index.html` | `https://brandly-five.vercel.app/faq` |

**HTML requirements (all three pages):**

- Full standalone documents: `<!DOCTYPE html>`, `<html>`, `<head>`, `<body>`.
- Meaningful `<title>` and `<meta name="description">`.
- **All crawlable facts as real HTML** in the first response: `<h1>`, `<h2>`, `<p>`, `<ul>`, `<ol>`, `<a>`. No React. No “content loaded by JS”.
- Cross-links between `/help`, `/pricing`, `/faq`, and `/` so Aide’s crawler can discover siblings.
- Content adapted from `aide-brandly-knowledge.md` (What is Brandly, getting started, escrow/payouts, AI matching, support topics, fees). Keep customer language; no secrets, no API keys, no internal demo credentials.

**Minimum topics**

- **help:** product overview, getting started steps, escrow lifecycle, disputes (3–5 days), AI matching, links to pricing/faq.
- **pricing:** platform fees / escrow funding model, Stripe Connect payouts, KYC / instant payout note (as in knowledge md). Add real plan names/prices only if already public on Brandly marketing.
- **faq:** 6–12 Q&A from “Support topics covered in Help Center” in the knowledge md.

Keep pages readable and dense enough for RAG (several hundred words total across the three is fine).

### 2) Fix Vercel SPA rewrites so static pages are not swallowed

Inspect existing `vercel.json` (create if missing).

**Problem:** a catch-all like `"/(.*)" → /index.html` serves the empty SPA for `/help`.

**Required behavior:**

1. `/help`, `/pricing`, `/faq` (and trailing slash / nested) resolve to the static `*/index.html` files.
2. All other client routes still SPA-fallback to `/index.html`.

Example pattern (adjust to match existing config; prefer explicit destinations over a broken negative lookahead if the platform is picky):

```json
{
  "rewrites": [
    { "source": "/help", "destination": "/help/index.html" },
    { "source": "/help/", "destination": "/help/index.html" },
    { "source": "/pricing", "destination": "/pricing/index.html" },
    { "source": "/pricing/", "destination": "/pricing/index.html" },
    { "source": "/faq", "destination": "/faq/index.html" },
    { "source": "/faq/", "destination": "/faq/index.html" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Note:** On Vercel, more specific rewrites listed **before** the catch-all usually win. After deploy, if `/help` still shows SPA shell, the catch-all is still winning — fix order / config until curl shows static text.

Do **not** remove SPA fallback for the rest of the app.

### 3) Optional nav link (nice-to-have)

If there is a public landing footer/navbar, add links to `/help`, `/pricing`, `/faq` (plain `<a href="/help">`). Not required for crawl if seed URLs are pasted manually in Aide.

### 4) Do not change unless needed

- Leave `public/index.html` Aide embed script intact unless explicitly asked to update `data-aide-key`.
- Do not replace React `/help-center` page; static `/help` can coexist.
- Do not commit secrets (`.env`, Stripe live keys, Brandly API keys).

---

## Deploy

1. Commit on Brandly’s deploy branch (whatever maps to `brandly-five.vercel.app`).
2. Deploy (Vercel production for that project).
3. Wait until deployment is Ready.

---

## Verification (implementer must run)

```bash
# Must print matching lines from page body text:
curl -sL "https://brandly-five.vercel.app/help" | grep -i escrow
curl -sL "https://brandly-five.vercel.app/pricing" | grep -i fee
curl -sL "https://brandly-five.vercel.app/faq" | grep -i payout

# Fail if only SPA shell:
curl -sL "https://brandly-five.vercel.app/help" | grep -c 'id="root"'
# root may still appear if you mistakenly pointed rewrite at SPA — body must still contain help text outside empty root
```

Manual: open `/help` → View Page Source → confirm paragraphs exist.

**Aide (manual after Brandly is live):**

1. Open coral Aide → agent Knowledge.
2. Re-crawl seeds (same domain, one per line):

```text
https://brandly-five.vercel.app/help
https://brandly-five.vercel.app/pricing
https://brandly-five.vercel.app/faq
```

3. Expect job **DONE** (or PARTIAL with indexed WEB docs + `sourceUrl`).
4. Test studio: ask “How does Brandly escrow work?” → answer grounded in crawled text.

If crawl still returns empty/SPA message, static HTML or rewrites are wrong — fix Brandly, do not change Aide crawl for this plan.

---

## Handoff notes for the implementing agent

- Work in **Brandly / brandin**, not AI-Customer-Support-Agent, unless only documenting.
- Prefer small diff: 3 HTML files + `vercel.json` rewrite fix (+ optional nav links).
- Content source of truth: `aide-brandly-knowledge.md` in brandin.
- Report back: deploy URL, curl evidence (grep hits), and whether Aide crawl was tested.

---

## Related Aide docs (read-only)

- Aide customer crawl tips: `content/customer-docs/80-website-crawl.md`
- Aide troubleshooting own-product /docs: `content/customer-docs/200-troubleshooting.md`
- Why Brandly needed browser crawl historically: `docs/audits/help-center-assistant-full-audit-2026-09-24.md` (F10) — this plan avoids that by publishing HTML.
