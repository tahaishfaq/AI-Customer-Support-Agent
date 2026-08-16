/** Placeholder snippet until public embed (Phase 8). */

const FALLBACK_ORIGIN = "https://your-app.com";

export function buildEmbedSnippet(agentId, origin = FALLBACK_ORIGIN) {
  const host = origin || FALLBACK_ORIGIN;

  return `<!-- Hapy webchat — public embed goes live in the next phase -->
<script src="${host}/embed.js" defer></script>
<script>
  window.hapyChat?.init({ agentId: "${agentId}" });
</script>`;
}
