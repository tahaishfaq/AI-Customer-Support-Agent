/**
 * Detect GitHub MCP servers that look auth-broken from last probe error.
 * No secrets — uses serialized lastError text only.
 * @param {Array<{ name?: string, url?: string, enabled?: boolean, lastError?: string|null }>|null|undefined} servers
 * @returns {Array<{ id?: string, name: string, lastError: string }>}
 */
export function githubMcpAuthIssues(servers) {
  const list = Array.isArray(servers) ? servers : [];
  const out = [];
  for (const server of list) {
    if (server?.enabled === false) continue;
    const name = String(server?.name || "");
    const url = String(server?.url || "");
    const isGithub =
      /github/i.test(name) ||
      /github\.com|api\.github\.copilot|github\/mcp/i.test(url);
    if (!isGithub) continue;
    const err = String(server?.lastError || "").trim();
    if (!err) continue;
    if (
      !/auth|unauthor|401|403|token|expired|invalid|oauth|forbidden/i.test(err)
    ) {
      continue;
    }
    out.push({
      id: server.id,
      name: name || "GitHub MCP",
      lastError: err.slice(0, 200),
    });
  }
  return out;
}
