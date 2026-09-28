---
title: Connect GitHub (MCP)
description: Link GitHub so your agent can use GitHub tools safely.
slug: tools/mcp-github
order: 160
---

# Connect GitHub (MCP)

Aide can connect to **GitHub MCP** so the agent may use allowlisted GitHub tools (profile, repos, create repository, and more — depending on what you enable).

![Sample: GitHub MCP Connect with OAuth and Actions On](/customer-docs/mcp-github.svg)

## Connect with OAuth (recommended on production)

1. Open the agent → **Customization** → **Tools** / MCP
2. Turn **Actions** **On**
3. Add or open **GitHub MCP**
4. Click **Connect with OAuth** and approve on GitHub
5. Return to Aide, then **Test connection**

Your host must register the callback URL on the GitHub OAuth App and set platform secrets (`GITHUB_MCP_OAUTH_CLIENT_ID` / `SECRET`). If OAuth is not configured, use a personal access token (PAT) with Save & probe instead.

## When you see an auth error

Messages like `MCP_AUTH` or “AuthenticateToken authentication failed” mean the stored token is invalid or expired.

1. Open Tools
2. Reconnect with OAuth or paste a fresh PAT
3. Run **Test connection** until the probe error clears
4. Retry your chat

You do **not** need to reconnect after every normal code deploy if secrets and the database stay the same.

## Local vs production

OAuth callbacks are tied to the app URL. Connect GitHub on the environment where the OAuth App callback is registered (usually production). Localhost needs its own callback entry if you want local OAuth.

## Related

- [Tools overview](/docs/tools/overview)
- [Confirmations](/docs/tools/confirmations)
- [Troubleshooting](/docs/troubleshooting)
