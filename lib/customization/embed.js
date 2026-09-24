/** Live public-widget snippet. */

const FALLBACK_ORIGIN = "https://your-app.com";

/**
 * One install snippet for every site.
 * Logged-in identity examples live under Deploy → Logged-in customers (optional).
 */
export function buildEmbedSnippet(publicKey, origin = FALLBACK_ORIGIN) {
  const host = origin || FALLBACK_ORIGIN;
  const key = publicKey || "YOUR_PUBLIC_KEY";

  return `<!-- AIDE webchat — paste once in your site HTML -->
<script
  src="${host}/embed.js?v=13"
  data-aide-key="${key}"
  defer
></script>`;
}
