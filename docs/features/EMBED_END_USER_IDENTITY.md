# Embed end-user identity (universal customer support)

Status: Hardened (2026-09-18) — ACCOUNT_* on public embed require HS256  
Scope: Host sites embedding Aide + ACCOUNT_* HTTP/MCP tools.

## Why this exists

Public FAQs work anonymously. **My order / my account / my ticket** tools must bind to a **cryptographically verified** visitor. A raw `customerId` typed in chat or a browser `setUser({ subject })` alone is **not** authority on the public embed.

## Single runtime rule

```text
Embed origin lock → HS256 identity JWT (ACCOUNT_*) → resolveEndUserIdentity
  → policy (accessClass + identityStrategy) → tool gateway → fenced result
```

- `ACCOUNT_READ` / `ACCOUNT_WRITE` / `DESTRUCTIVE` on **embed** → need `identityStrategy === hs256_jwt` (+ access token for END_USER_TOKEN outbound).
- Browser `host_session` subject alone → **IDENTITY_PROOF_REQUIRED** for ACCOUNT tools.
- `GUEST_LOOKUP` → may run without JWT; merchant API must redact other customers.
- `PUBLIC_READ` → catalog-style; still confirm on embed when configured.
- Studio can still mint JWT via owner API for testing.

## Strategy A — Host session (display / outbound only)

After your site login:

```js
aideChat.setUser({
  subject: "user_123",
  displayName: "Alex",
  accessToken: merchantToken, // outbound Bearer to YOUR API
});
```

This does **not** unlock ACCOUNT_* tools by itself on the public embed. Use Strategy B for account tools.

## Strategy B — Aide-signed HS256 JWT (required for ACCOUNT_*)

Your **backend** (never the browser) mints a JWT with `ACTIONS_IDENTITY_SECRET`:

```js
// Prefer POST /api/agents/:id/identity/mint (owner) or mintEndUserIdentityToken
{ sub: "user_123", exp: <unix>, iss: "aide:agent:<agentId>", aud: "aide-embed" }
```

Pass the JWT via `Authorization: Bearer`, chat `identityToken`, or `setUser({ accessToken: jwt })` **without** a conflicting host subject (or with matching `subject`).

Aide verifies signature and binds `iss`/`aud` to the agent when present.

## Studio mint (testing)

`POST /api/agents/:agentId/identity/mint`  
Body: `{ "sub": "user_123", "ttlSeconds": 3600 }`  
Returns `{ token, expiresAt, strategy: "hs256_jwt" }`.

## What not to do

- Put `ACTIONS_IDENTITY_SECRET` in frontend or the embed snippet.
- Treat chat-typed order ids as proof of account ownership for ACCOUNT tools.
- Expect `setUser({ subject })` alone to authorize ACCOUNT tools on embed.

## Origin allowlist (complement to site lock)

Customization **Features → Embed origins**:

- `allowedOriginsMode: all` (default) — first live HTTPS site still claims `siteKnowledgeOrigin`.
- `allowedOriginsMode: allowlist` — public embed APIs and claim require Origin on the list (empty list = deny). Localhost / Aide app preview still allowed.

Enforced in `getPublicAgentByKey` + `claimEmbedOrigin` via `lib/embed/allowed-origins.js`. Does not replace the locked-origin rule.

## Related

- `lib/actions/identity.js` — verify + mint + strategy persistence
- `lib/actions/policy.js` — `IDENTITY_PROOF_REQUIRED`
- `lib/embed/identity-merchant.js` — snippets / strategy copy
- `lib/embed/allowed-origins.js` — allowlist gate
- Deploy UI → **Signed-in visitors** panel / Features → **Embed origins**
