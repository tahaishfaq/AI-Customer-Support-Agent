/**
 * Per-turn tool offer: HTTP/builtin tools always; MCP tools only when the question points at them,
 * capped, and never from a server whose credential failed. Relevance is lexical and display-free:
 * it only narrows what the model may request — policy/PEP still gates every call.
 */

export const MAX_MCP_TOOLS_PER_TURN = 12;

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "you", "your", "yours", "our", "ours", "my", "mine", "me", "this",
  "that", "these", "those", "what", "whats", "how", "why", "when", "where", "who", "which", "does",
  "did", "can", "could", "would", "should", "will", "please", "tell", "about", "work", "works",
  "need", "want", "know", "have", "has", "are", "was", "were", "been", "any", "some", "there",
  "here", "from", "into", "out", "get", "use", "used", "using", "help", "thanks", "thank", "hey",
  "hello", "just", "like", "also", "more", "much", "many", "they", "them", "their", "its", "not",
  "all", "one", "via", "per", "etc", "tool", "tools", "user", "users", "then", "than",
]);

const GITHUB_CORE_TOOL_RE = /(^|_)(get_me|search_repositories|list_repositories)$/;

function normalizeToken(token) {
  return token.length > 4 && token.endsWith("s") ? token.slice(0, -1) : token;
}

/** Content words (≥3 chars, no stop words), lightly singularised. */
export function contentTokens(text) {
  const out = new Set();
  for (const raw of String(text || "").toLowerCase().split(/[^a-z0-9]+/)) {
    if (raw.length < 3 || STOP_WORDS.has(raw)) continue;
    out.add(normalizeToken(raw));
  }
  return out;
}

/** How many of the question's content words appear in the tool's name or description. */
export function toolRelevance(action, questionTokens) {
  if (!questionTokens?.size) return 0;
  const toolTokens = contentTokens(`${action?.name || ""} ${action?._mcp?.remoteName || ""} ${action?.description || ""}`);
  let score = 0;
  for (const token of questionTokens) if (toolTokens.has(token)) score += 1;
  return score;
}

function isGithubMcp(action) {
  return Boolean(action?._mcp) && /github/i.test(`${action?.name || ""} ${action?._mcp?.url || ""}`);
}

/**
 * @param {Array<object>} actions offered actions (HTTP, builtin, MCP)
 * @param {{ utterance?: string, wantsGithub?: boolean, maxMcp?: number }} opts
 */
export function shortlistToolsForTurn(actions, { utterance = "", wantsGithub = false, maxMcp = MAX_MCP_TOOLS_PER_TURN } = {}) {
  const list = Array.isArray(actions) ? actions : [];
  const tokens = contentTokens(utterance);
  const keep = [];
  const mcp = [];
  for (const action of list) {
    if (!action?._mcp) {
      keep.push(action);
      continue;
    }
    const github = isGithubMcp(action);
    if (action._mcp.authFailed) {
      // Direct GitHub ask on a failed credential: one probe call yields the accurate
      // "reconnect GitHub" reply (and notices a token fixed elsewhere). Otherwise hide.
      if (wantsGithub && github && /(^|_)get_me$/.test(String(action._mcp.remoteName || ""))) {
        mcp.push({ action, score: 1, core: true });
      }
      continue;
    }
    const score = toolRelevance(action, tokens) + (wantsGithub && github ? 1 : 0);
    const core = wantsGithub && github && GITHUB_CORE_TOOL_RE.test(String(action._mcp.remoteName || action.name || ""));
    if (score > 0 || core) mcp.push({ action, score, core });
  }
  mcp.sort((a, b) => Number(b.core) - Number(a.core) || b.score - a.score);
  return [...keep, ...mcp.slice(0, Math.max(0, maxMcp)).map((entry) => entry.action)];
}

/** Non-builtin READ tools whose name/description match the question (best first, max 3). */
export function relevantToolNames(actions, utterance) {
  const tokens = contentTokens(utterance);
  return (Array.isArray(actions) ? actions : [])
    .filter((action) => action && !action._builtin && String(action.riskLevel || "READ") === "READ")
    .map((action) => ({ name: action.name, score: toolRelevance(action, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((entry) => entry.name);
}
