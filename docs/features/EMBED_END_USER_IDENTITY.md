# Embed end-user identity (universal customer support)

Status: Productized mechanism (2026-09-17)  
Scope: Host sites embedding Aide + ACCOUNT_* HTTP/MCP tools.

## Why this exists

Public FAQs work anonymously. **My order / my account / my ticket** tools must bind to a verified visitor. A raw `customerId` typed in the chat box or sent from browser JS is **not** authority.

## Single runtime rule

```text
Embed origin lock → setUser / JWT → resolveEndUserIdentity
  → policy (accessClass) → tool gateway → fenced result
```

- `ACCOUNT_READ` / `ACCOUNT_WRITE` / `DESTRUCTIVE` → need verified subject (+ access token for END_USER_TOKEN).
- `GUEST_LOOKUP` → may run without setUser; merchant API must redact other customers.
- `PUBLIC_READ` → catalog-style; still confirm on embed when configured.

## Strategy A — Host session (recommended for most merchants)

After your site login, on every page load:

```js
aideChat.setUser({
  subject: "user_123",          // stable id in YOUR system
  displayName: "Alex",
  accessToken: merchantToken,   // sent to ACCOUNT tools as Bearer
});
```

On logout: `aideChat.clearUser()`.

Aide trusts `subject` because the embed origin is locked to your site. `accessToken` is for **your** API (or connector), not for forging Aide admin access.

Refresh hook:

```js
aideChat.onAuthRefreshNeeded = async function () {
  const accessToken = await fetchFreshAccessToken();
  aideChat.setUser({ subject: "user_123", accessToken });
};
```

## Strategy B — Aide-signed HS256 JWT

Your **backend** (never the browser) mints a JWT with `ACTIONS_IDENTITY_SECRET`:

```js
// Server-side only — see mintEndUserIdentityToken in lib/actions/identity.js
// or POST /api/agents/:id/identity/mint (owner session, for studio/backend tests)
{ sub: "user_123", exp: <unix>, email?: "...", phone?: "..." }
```

Pass the JWT via `aideChat.setUser({ subject, accessToken: jwt })` or `Authorization: Bearer`.

## Studio mint (testing)

Authenticated owner:

`POST /api/agents/:agentId/identity/mint`  
Body: `{ "sub": "user_123", "ttlSeconds": 3600 }`  
Returns `{ token, expiresAt, strategy: "hs256_jwt" }`.

Do not expose this endpoint to anonymous embed visitors.

## What not to do

- Put `ACTIONS_IDENTITY_SECRET` in frontend or the embed snippet.
- Treat chat-typed order ids as proof of account ownership for ACCOUNT tools.
- Claim “Connected” from pack install alone (integrations are separate).

## Related

- `lib/actions/identity.js` — verify + mint
- `lib/embed/identity-merchant.js` — snippets / strategy copy
- `lib/actions/policy.js` — ACCOUNT without subject → `IDENTITY_REQUIRED`
- Deploy UI → **Signed-in visitors** panel
