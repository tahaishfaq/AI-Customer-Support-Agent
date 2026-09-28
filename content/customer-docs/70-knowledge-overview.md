---
title: Knowledge overview
description: How Aide uses knowledge to answer customers.
slug: knowledge/overview
order: 70
---

# Knowledge overview

Knowledge is the text your agent is allowed to treat as **your** product truth.

![Sample: Knowledge crawl panel with DONE status](/customer-docs/knowledge-crawl.svg)

## Ways to add knowledge

- **Upload** files or paste documents in the Knowledge tab
- **Crawl** public https pages of your website (same domain per crawl)
- Keep important FAQs as dedicated documents for fast retrieval

## What works best

- Clear help articles, pricing pages, policies, how-tos
- Public HTML pages (not empty JavaScript-only shells)
- Stable URLs you are happy to show as “Learn more” links

## What is skipped

- Localhost
- Login, account, admin, checkout-style paths
- The Aide **app root** itself — use [Aide Docs](/docs) (`/docs/...`) if you want to crawl Aide’s own help for a support agent

## Related

- [Website crawl](/docs/knowledge/website-crawl)
- [Uploads](/docs/knowledge/uploads)
