---
title: Tools and actions
description: Let your agent call APIs with policy and Confirm.
slug: tools/overview
order: 130
---

# Tools and actions

Tools let the agent **do** things beyond answering from knowledge — for example fetch store data or call GitHub.

## Kill switch

Under Tools / Actions, the agent has an **Actions** on/off control. When Actions are **off**, tools will not run and many toggles stay disabled. Turn Actions **on** to use tools in Test and embed.

## Risk levels

- **READ** tools can often run without visitor Confirm
- **WRITE** / destructive tools require an explicit **Confirm** in the chat UI
- The model cannot approve a write by itself

## Related

- [HTTP tools](/docs/tools/http)
- [GitHub MCP](/docs/tools/mcp-github)
- [Confirmations](/docs/tools/confirmations)
