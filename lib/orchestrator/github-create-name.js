/**
 * Server-side GitHub create_repository name binding.
 * DATA != AUTHORITY: the model may invent suffixes (_2, _Repo); the name the
 * visitor asked for (or later chose) wins before Confirm / MCP dispatch.
 */

export function isGithubCreateRepositoryAction(action) {
  const remote = String(action?._mcp?.remoteName || "").toLowerCase();
  const name = String(action?.name || "").toLowerCase();
  return /create_repositor/.test(remote) || /create_repositor/.test(name);
}

function cleanRepoNameToken(value) {
  return String(value || "")
    .trim()
    .replace(/[.,;:]+$/g, "");
}

/**
 * Pull an explicit repo name from the visitor utterance.
 * @param {string} utterance
 * @returns {string|null}
 */
export function extractGithubRepoNameFromUtterance(utterance) {
  const raw = String(utterance || "").trim();
  if (!raw) return null;

  let m =
    raw.match(/\bnamed\s+[“"']([^“"']+)[”"']/i) ||
    raw.match(/\bnamed\s+([A-Za-z0-9][A-Za-z0-9_.-]*)/i);
  if (m?.[1]) return cleanRepoNameToken(m[1]) || null;

  m = raw.match(/\bname\s*[:=]\s*[“"']?([A-Za-z0-9][A-Za-z0-9_.-]*)/i);
  if (m?.[1]) return cleanRepoNameToken(m[1]) || null;

  m = raw.match(
    /\b(?:repo(?:sitory)?)\s+(?:called|named)\s+[“"']?([A-Za-z0-9][A-Za-z0-9_.-]*)/i
  );
  if (m?.[1]) return cleanRepoNameToken(m[1]) || null;

  // Whole-message bare token (follow-up: "Harness_Agent_2").
  if (/^[A-Za-z0-9][A-Za-z0-9_.-]{2,99}$/.test(raw) && /[_-]/.test(raw)) {
    return cleanRepoNameToken(raw) || null;
  }

  return null;
}

/**
 * Map "1" / "2" / "option 1" to a name offered in the prior assistant message.
 * @param {string} utterance
 * @param {string} [recentAssistantText]
 * @returns {string|null}
 */
export function extractOptionRepoName(utterance, recentAssistantText = "") {
  const t = String(utterance || "").trim();
  const opt = t.match(/^\s*(?:option\s*)?([12])\s*[).:]?\s*$/i);
  if (!opt) return null;
  const n = opt[1];
  const text = String(recentAssistantText || "");
  const patterns = [
    new RegExp(`\\(${n}\\)\\s*([A-Za-z0-9][A-Za-z0-9_.-]*)`, "i"),
    new RegExp(`(?:^|\\s)${n}[).:]\\s*([A-Za-z0-9][A-Za-z0-9_.-]*)`, "i"),
    new RegExp(
      `option\\s*${n}\\s*[):.–-]*\\s*([A-Za-z0-9][A-Za-z0-9_.-]*)`,
      "i"
    ),
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return cleanRepoNameToken(m[1]) || null;
  }
  return null;
}

/**
 * @param {{ utterance?: string, recentAssistantText?: string }} opts
 * @returns {string|null}
 */
export function resolveGithubCreateRepoName({
  utterance = "",
  recentAssistantText = "",
} = {}) {
  const fromOption = extractOptionRepoName(utterance, recentAssistantText);
  if (fromOption) return fromOption;
  return extractGithubRepoNameFromUtterance(utterance);
}

/**
 * Force create_repository args.name to the visitor-chosen name when known.
 * @returns {{ args: object, coerced: boolean, expectedName?: string|null, previousName?: string|null }}
 */
export function enforceGithubCreateRepositoryArgs({
  action,
  args,
  lastUserMessage = null,
  recentAssistantText = "",
} = {}) {
  if (!isGithubCreateRepositoryAction(action)) {
    return { args, coerced: false, expectedName: null };
  }
  const expected = resolveGithubCreateRepoName({
    utterance: lastUserMessage,
    recentAssistantText,
  });
  if (!expected) {
    return { args, coerced: false, expectedName: null };
  }
  const current = String(
    args?.name || args?.repo || args?.repository || ""
  ).trim();
  if (current === expected) {
    return { args, coerced: false, expectedName: expected };
  }
  return {
    args: { ...args, name: expected },
    coerced: true,
    expectedName: expected,
    previousName: current || null,
  };
}
