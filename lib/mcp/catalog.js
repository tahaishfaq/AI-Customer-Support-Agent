/**
 * MCP owner catalog — small fixed list (not a marketplace).
 * Live common card today: GitHub only. Add Notion/Linear/Stripe only via explicit change.
 */

/** @typedef {{
 *   id: string,
 *   kind: "demo"|"custom"|"common",
 *   name: string,
 *   blurb: string,
 *   authHint: "none"|"bearer"|"header",
 *   authCopy?: string,
 *   docsUrl?: string|null,
 *   defaultUrl?: string|null,
 *   defaultName?: string,
 *   comingSoon?: boolean,
 * }} McpCatalogEntry */

/** @type {McpCatalogEntry[]} */
export const MCP_CATALOG = Object.freeze([
  {
    id: "aide-demo",
    kind: "demo",
    name: "Aide demo MCP",
    blurb: "Local READ/WRITE demo tools (aide_demo_get_time, aide_demo_create_note).",
    authHint: "none",
    docsUrl: null,
    defaultUrl: null, // filled by UI with app origin
    defaultName: "AIDE demo MCP",
  },
  {
    id: "custom",
    kind: "custom",
    name: "Custom MCP",
    blurb: "Any Streamable HTTP MCP URL you already run.",
    authHint: "none",
    docsUrl: null,
    defaultUrl: null,
    defaultName: "Custom MCP",
  },
  {
    id: "github",
    kind: "common",
    name: "GitHub",
    blurb: "Issues, PRs, and repo triage via remote GitHub MCP.",
    authHint: "oauth",
    authCopy:
      "Connect with OAuth uses Aide’s pre-registered GitHub OAuth App (no dynamic client registration — GitHub MCP rejects DCR). Or attach a PAT as Bearer after save.",
    docsUrl: "https://github.com/github/github-mcp-server",
    defaultUrl: "https://api.githubcopilot.com/mcp/",
    defaultName: "GitHub MCP",
    comingSoon: false,
  },
]);

export function listMcpCatalog() {
  return [...MCP_CATALOG];
}

/**
 * @param {string} [query]
 * @returns {McpCatalogEntry[]}
 */
export function filterMcpCatalog(query = "") {
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return listMcpCatalog();
  return MCP_CATALOG.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      e.blurb.toLowerCase().includes(q) ||
      e.id.includes(q)
  );
}

/**
 * @param {string} id
 * @returns {McpCatalogEntry|null}
 */
export function getMcpCatalogEntry(id) {
  return MCP_CATALOG.find((e) => e.id === id) || null;
}

/** Live common cards only (excludes demo/custom). */
export function listCommonMcpCatalog() {
  return MCP_CATALOG.filter((e) => e.kind === "common" && !e.comingSoon);
}
