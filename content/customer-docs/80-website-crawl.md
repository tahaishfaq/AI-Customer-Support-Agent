---
title: Website crawl
description: Index public pages from your site into agent knowledge.
slug: knowledge/website-crawl
order: 80
---

# Website crawl

Use **Crawl / re-crawl website** to pull public https pages into knowledge.

![Sample: paste /docs URLs and Re-crawl now](/customer-docs/knowledge-crawl.svg)

## How to crawl

1. Open your agent → **Knowledge**
2. Paste one or more **https** URLs from the **same site** (one per line)
3. Click **Re-crawl now**
4. Wait until status is Done (or Partial / Failed — then fix and retry)

Example:

```text
https://www.example.com
https://www.example.com/pricing
https://www.example.com/help
```

## Aide’s own docs

To teach an agent about Aide itself, crawl the docs section — not the app home:

```text
https://YOUR-AIDE-HOST/docs
https://YOUR-AIDE-HOST/docs/getting-started/what-is-aide
```

Pasting only the Aide app root is rejected on purpose. See [Troubleshooting](/docs/troubleshooting).

## Tips

- Prefer real HTML help content
- SPA shells may need browser crawl enabled by your host admin
- After a successful crawl, ask test questions that match page titles

## Related

- [Knowledge overview](/docs/knowledge/overview)
- [FAQ](/docs/faq)
