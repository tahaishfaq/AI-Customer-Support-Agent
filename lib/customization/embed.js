/** Live public-widget snippet. */

const FALLBACK_ORIGIN = "https://your-app.com";

export function buildEmbedSnippet(publicKey, origin = FALLBACK_ORIGIN) {
  const host = origin || FALLBACK_ORIGIN;
  const key = publicKey || "YOUR_PUBLIC_KEY";

  return `<!-- Hapy webchat -->
<script
  src="${host}/embed.js?v=7"
  data-hapy-key="${key}"
  defer
></script>`;
}
