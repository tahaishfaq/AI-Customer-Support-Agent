/**
 * Channel-aware GitHub inventory / MCP auth refuse copy.
 * Kept free of LLM imports so contract tests can load it cheaply.
 */

const GITHUB_INVENTORY_REFUSE_STUDIO =
  "I could not retrieve that GitHub inventory from the connected MCP tools. Please retry with a clearer query (for example search_repositories with user:NAME language:JavaScript), or check which GitHub tools are enabled. I will not invent repository lists from memory or Agent knowledge.";

const GITHUB_INVENTORY_REFUSE_EMBED =
  "I could not load that GitHub information right now. Please try again with a clearer request, or ask the site owner to check the GitHub connection. I will not invent repository lists.";

const GITHUB_MCP_AUTH_REFUSE_STUDIO =
  "Connected GitHub MCP returned an authentication error (token expired or invalid). Reconnect GitHub under Tools — Connect with OAuth or paste a fresh personal access token — then try again. I will not invent repository or profile data.";

const GITHUB_MCP_AUTH_REFUSE_EMBED =
  "I can’t reach GitHub right now — the connection sign-in looks expired. Please ask the site owner to reconnect GitHub, then try again. I will not invent repository or profile data.";

/**
 * @param {Array} [toolSteps]
 * @param {{ publicAccess?: boolean }} [opts]
 */
export function githubInventoryRefuseMessage(toolSteps = [], opts = {}) {
  const embed = Boolean(opts.publicAccess);
  const authFail = (Array.isArray(toolSteps) ? toolSteps : []).some((step) => {
    const code = String(step?.errorCode || step?.error || "").toUpperCase();
    return code === "MCP_AUTH" || code.includes("AUTH");
  });
  if (authFail) {
    return embed ? GITHUB_MCP_AUTH_REFUSE_EMBED : GITHUB_MCP_AUTH_REFUSE_STUDIO;
  }
  return embed ? GITHUB_INVENTORY_REFUSE_EMBED : GITHUB_INVENTORY_REFUSE_STUDIO;
}

export {
  GITHUB_INVENTORY_REFUSE_STUDIO,
  GITHUB_INVENTORY_REFUSE_EMBED,
  GITHUB_MCP_AUTH_REFUSE_STUDIO,
  GITHUB_MCP_AUTH_REFUSE_EMBED,
};
