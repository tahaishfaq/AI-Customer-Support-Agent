/**
 * Merchant-facing embed identity helpers (client-safe).
 * No secrets. Runtime authority stays in lib/actions/identity.js + policy.js.
 */

export const IDENTITY_STRATEGIES = Object.freeze({
  HOST_SESSION: "host_session",
  HS256_JWT: "hs256_jwt",
});

/**
 * Primary path for most merchants: origin-locked embed trusts host subject.
 * accessToken is for outbound ACCOUNT tools (merchant API), not Aide signing.
 */
export function buildHostSessionSetUserSnippet({
  subject = "user_123",
  displayName = "Alex",
  accessTokenPlaceholder = "MERCHANT_SESSION_OR_API_TOKEN",
} = {}) {
  const sub = String(subject || "user_123").replace(/"/g, "");
  const name = String(displayName || "Alex").replace(/"/g, "");
  return `<!-- After your site login (every page load while signed in) -->
<script>
  // Option A — one object; embed.js applies it automatically on load
  window.__AIDE_CHAT_USER__ = {
    subject: "${sub}",
    displayName: "${name}",
    accessToken: "${accessTokenPlaceholder}"
  };
  // Option B — explicit (same effect)
  window.aideChat && aideChat.setUser(window.__AIDE_CHAT_USER__);
  aideChat.onAuthRefreshNeeded = async function () {
    const accessToken = await fetchFreshAccessToken(); // your app
    window.__AIDE_CHAT_USER__ = { subject: "${sub}", displayName: "${name}", accessToken };
    aideChat.setUser(window.__AIDE_CHAT_USER__);
  };
</script>`;
}

/**
 * Stronger path: Aide-verified HS256 JWT (sub required).
 * Mint only on a server that holds ACTIONS_IDENTITY_SECRET — never in the browser.
 */
export function buildHs256JwtSetUserSnippet({
  subject = "user_123",
  displayName = "Alex",
} = {}) {
  const sub = String(subject || "user_123").replace(/"/g, "");
  const name = String(displayName || "Alex").replace(/"/g, "");
  return `<!-- Prefer minting on your backend; pass JWT as accessToken OR Authorization Bearer -->
<script>
  // identityJwt = await fetch("/your-api/aide-identity").then(r => r.json()).then(d => d.token)
  window.aideChat && aideChat.setUser({
    subject: "${sub}",
    displayName: "${name}",
    accessToken: identityJwt
  });
</script>`;
}

export function describeIdentityStrategies() {
  return [
    {
      id: IDENTITY_STRATEGIES.HOST_SESSION,
      title: "Host session (display + outbound token)",
      summary:
        "Call aideChat.setUser({ subject, accessToken }) after login for display name and outbound Bearer. ACCOUNT_* tools on the public embed still require an Aide-signed HS256 JWT (Strategy B) — host subject alone is not proof.",
      requiresAideSecret: false,
    },
    {
      id: IDENTITY_STRATEGIES.HS256_JWT,
      title: "Aide-signed JWT (required for ACCOUNT tools)",
      summary:
        "Your backend mints HS256 JWT with { sub, exp, iss: aide:agent:<id>, aud: aide-embed } using ACTIONS_IDENTITY_SECRET. Pass as identityToken / Bearer or setUser accessToken without a conflicting subject.",
      requiresAideSecret: true,
    },
  ];
}

/** Owner-facing rules — never treat raw browser customerId as authority. */
export const IDENTITY_PRODUCT_RULES = Object.freeze([
  "Raw browser customerId / orderId alone never unlocks ACCOUNT_READ or ACCOUNT_WRITE.",
  "ACCOUNT_* tools on the public embed require an Aide-signed HS256 JWT (not browser setUser subject alone).",
  "Host setUser subject may still be used for display; it does not authorize ACCOUNT tools.",
  "GUEST_LOOKUP may run without setUser but must return redacted data for that lookup only.",
  "Never put ACTIONS_IDENTITY_SECRET in frontend JS or the embed snippet.",
  "On logout call aideChat.clearUser().",
]);
