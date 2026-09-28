---
title: Troubleshooting
description: Fix crawl, MCP, embed, and Actions issues.
slug: troubleshooting
order: 200
---

# Troubleshooting

## Crawl says “Invalid URL” for the Aide site

You pasted the Aide **app** origin. Use your customer site, or Aide docs:

```text
https://YOUR-AIDE-HOST/docs
```

## MCP / GitHub auth error

1. Tools → Actions **On**
2. Reconnect GitHub OAuth or new PAT
3. Test connection
4. Retry the chat

## Enable / disable switches do nothing

Actions kill switch is likely **Off**. Enable Actions for the agent first.

## Embed does not appear

- Check script public key
- Confirm [allowed origins](/docs/embed/origins)
- Confirm agent is enabled
- Hard-refresh the host page

## Empty or weak answers

- Knowledge empty or crawl failed
- Question not covered by docs — add a page or upload
- Wait for indexing after upload/crawl

## Still stuck

Retry from [Test studio](/docs/agents/test-studio) with a simple knowledge question, then re-enable tools one at a time.

## Related

- [FAQ](/docs/faq)
- [GitHub MCP](/docs/tools/mcp-github)
- [Website crawl](/docs/knowledge/website-crawl)
