---
title: Core concepts
description: Agents, knowledge, embed, tools, and confirmations in Aide.
slug: getting-started/concepts
order: 20
---

# Core concepts

## Agent

An **agent** is your AI support personality. It has a name, instructions, knowledge, and optional tools. Each agent can be tested in the studio and embedded on a site.

## Knowledge

**Knowledge** is the trusted text your agent uses to answer (uploads, pasted content, or pages from a website crawl). Prefer clear, public help content. Private login pages are not crawled.

## Embed / webchat

The **embed** is the chat widget visitors see on your site. You customize appearance, then install a small script with your agent’s public key.

## Tools & actions

**Tools** let the agent call external systems (for example list products, create a GitHub repo). Sensitive **WRITE** actions require the visitor to **Confirm** before they run. The agent cannot invent tool results as authority.

## Connected apps (MCP)

Some integrations use **MCP** (Model Context Protocol) servers — for example GitHub. You connect once under Tools; the token is stored encrypted for that workspace.

## Inbox & handoff

When AI is not enough, conversations can go to a **human** desk (inbox / escalation), depending on your setup.

## Learn more

- [Knowledge overview](/docs/knowledge/overview)
- [Tools overview](/docs/tools/overview)
- [Embed install](/docs/embed/install)
