/** Live public-widget snippet. */

import { buildHostSessionSetUserSnippet } from "../embed/identity-merchant.js";

const FALLBACK_ORIGIN = "https://your-app.com";

export function buildEmbedSnippet(publicKey, origin = FALLBACK_ORIGIN) {
  const host = origin || FALLBACK_ORIGIN;
  const key = publicKey || "YOUR_PUBLIC_KEY";
  const setUserExample = buildHostSessionSetUserSnippet();

  return `<!-- AIDE webchat -->
<script
  src="${host}/embed.js?v=11"
  data-aide-key="${key}"
  defer
></script>
<!--
  Signed-in visitors (ACCOUNT tools): pass an Aide-signed HS256 identity JWT
  (mint from your backend). Raw browser customerId / setUser subject alone
  never unlocks ACCOUNT_READ on the public embed.
  See Deploy → Signed-in visitors.
  Live WRITE tools always Confirm in the widget before calling your API.
  Guest lookups must return redacted data only.
  Docs: docs/features/EMBED_END_USER_IDENTITY.md
-->
${setUserExample}`;
}
