---
title: HTTP tools
description: Connect your own APIs as agent actions.
slug: tools/http
order: 140
---

# HTTP tools

You can add HTTP actions that call your public APIs (with SSRF protections and timeouts).

## Basics

1. Open Tools → add or edit an HTTP action
2. Set method, URL template, and risk level
3. Attach a credential when the API needs auth
4. Enable the action and keep agent **Actions** on
5. Test in the Test studio

## Safety

Aide validates hosts, blocks private networks, and fences tool results as untrusted data. Tool output never becomes identity or permission by itself.

## Related

- [Tools overview](/docs/tools/overview)
- [Confirmations](/docs/tools/confirmations)
