/** Live public-widget snippet. */

const FALLBACK_ORIGIN = "https://your-app.com";

export function buildEmbedSnippet(publicKey, origin = FALLBACK_ORIGIN) {
  const host = origin || FALLBACK_ORIGIN;
  const key = publicKey || "YOUR_PUBLIC_KEY";

  return `<!-- Aide webchat -->
<script
  src="${host}/embed.js?v=11"
  data-aide-key="${key}"
  defer
></script>
<!--
  Signed-in visitors (every page load — not only after login click):
  window.aideChat.setUser({ subject, displayName, accessToken });
  Live tools always ask Confirm in the widget before calling your API.
  Guest lookups must return redacted data; never another customer's private fields.
  Refresh hook:
  aideChat.onAuthRefreshNeeded = async function () {
    const accessToken = await fetchFreshAccessToken();
    aideChat.setUser({ subject: "user_123", accessToken });
  };
-->
<!-- Example:
<script>
  window.aideChat && aideChat.setUser({
    subject: "user_123",
    displayName: "Alex",
    accessToken: "…"
  });
  aideChat.onAuthRefreshNeeded = async function () {
    const token = await fetchFreshAccessToken();
    aideChat.setUser({ subject: "user_123", accessToken: token });
  };
</script>
-->`;
}
