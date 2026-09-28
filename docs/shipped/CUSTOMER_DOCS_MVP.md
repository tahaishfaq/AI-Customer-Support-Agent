# Customer Docs MVP (`/docs`)

Public Aide help pages on the app origin, crawlable into an agent knowledge base, with Learn more links in support answers.

Sample screenshots live under `public/customer-docs/` (real Docs home PNG + UI sample SVGs) and are embedded in the Markdown so `/docs` pages are easier to visualize.

## What shipped

- Public routes: `/docs` and `/docs/...` from Markdown in `content/customer-docs/`
- Owner crawl may seed `https://{appOrigin}/docs` (and `/docs/**` only). Bare app root stays blocked as own-product
- Public webchat shows HTTPS knowledge `sourceUrl` chips; the system prompt asks the model to end grounded replies with **Learn more** markdown links (no invented URLs)

## Post-deploy dogfood (Aide Support agent)

Use the coral production origin (or your deployed app URL):

1. Create or open an **Aide Support** agent.
2. **Knowledge → Re-crawl now** with seed:
   `https://ai-customer-support-agent-coral.vercel.app/docs`
   (optional: add key subpaths such as `/docs/mcp-github`, `/docs/faq` if the first crawl is thin).
3. Wait until the crawl job is **DONE**. In Knowledge, confirm documents show `sourceUrl` under `/docs/...`.
4. Studio smoke: ask **How do I connect GitHub?** — expect a grounded answer plus a Learn more line or source chip pointing at `/docs/...`.
5. Public embed smoke: same question on the agent’s live widget — expect at least one clickable `/docs/...` Learn more chip or markdown link.

## Local checks

```bash
node --import ./scripts/register-aliases.mjs scripts/test-crawl-aide-docs.mjs
node --import ./scripts/register-aliases.mjs scripts/test-knowledge-learn-more.mjs
```

Open `/docs` and a child page in the browser; view-source should include article body text (not an empty SPA shell).
