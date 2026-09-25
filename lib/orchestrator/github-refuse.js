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

const GITHUB_WRITE_REFUSE_STUDIO =
  "I couldn't complete that GitHub repository change with the connected MCP tools. Check Tools → GitHub connection and that the name is available, then try again. I will not invent a success URL.";

const GITHUB_WRITE_REFUSE_EMBED =
  "I couldn't complete that GitHub change right now. Please try again or ask the site owner to check the GitHub connection. I will not invent a success.";

function isAuthFailStep(step) {
  const code = String(step?.errorCode || step?.error || "").toUpperCase();
  return code === "MCP_AUTH" || code.includes("AUTH");
}

function redactSecrets(text) {
  return String(text || "")
    .replace(/\bghp_[A-Za-z0-9]+\b/g, "[redacted]")
    .replace(/\bgho_[A-Za-z0-9]+\b/g, "[redacted]")
    .replace(/\bghu_[A-Za-z0-9]+\b/g, "[redacted]")
    .replace(/\bghs_[A-Za-z0-9]+\b/g, "[redacted]");
}

function isNameConflictDetail(detail) {
  return /already exists|name.?taken|name already|repository.?exists|name is not available|name.?conflict/i.test(
    String(detail || "")
  );
}

function repoNameFromWriteStep(step) {
  const raw = step?._argsRaw ?? step?.argsRaw ?? step?.args ?? null;
  if (!raw) return "";
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const n = parsed?.name || parsed?.repo || parsed?.repository;
    return typeof n === "string" ? n.trim() : "";
  } catch {
    return "";
  }
}

function suggestRepoAltNames(name) {
  const base = String(name || "")
    .trim()
    .replace(/[_-]+$/g, "");
  if (!base) return [];
  return [`${base}_2`, `${base}-v2`];
}

function lastGithubWriteStep(toolSteps = []) {
  const list = Array.isArray(toolSteps) ? toolSteps : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const name = String(list[i]?.name || "").toLowerCase();
    if (
      name.includes("mcp_") &&
      name.includes("github") &&
      /create_repositor|push_files|create_or_update_file|update_file|delete_file|fork_repositor/.test(
        name
      )
    ) {
      return list[i];
    }
  }
  return null;
}

/**
 * @param {Array} [toolSteps]
 * @param {{ publicAccess?: boolean }} [opts]
 */
export function githubInventoryRefuseMessage(toolSteps = [], opts = {}) {
  const embed = Boolean(opts.publicAccess);
  const authFail = (Array.isArray(toolSteps) ? toolSteps : []).some(isAuthFailStep);
  if (authFail) {
    return embed ? GITHUB_MCP_AUTH_REFUSE_EMBED : GITHUB_MCP_AUTH_REFUSE_STUDIO;
  }
  return embed ? GITHUB_INVENTORY_REFUSE_EMBED : GITHUB_INVENTORY_REFUSE_STUDIO;
}

/**
 * Refuse copy when a GitHub WRITE (create/update) failed — not inventory/list language.
 * @param {Array} [toolSteps]
 * @param {{ publicAccess?: boolean }} [opts]
 */
export function githubWriteRefuseMessage(toolSteps = [], opts = {}) {
  const embed = Boolean(opts.publicAccess);
  const authFail = (Array.isArray(toolSteps) ? toolSteps : []).some(isAuthFailStep);
  if (authFail) {
    return embed ? GITHUB_MCP_AUTH_REFUSE_EMBED : GITHUB_MCP_AUTH_REFUSE_STUDIO;
  }
  const step = lastGithubWriteStep(toolSteps);
  let rawDetail = String(step?.bodyText || "").trim();
  if (!rawDetail && step?.resultForModel) {
    const blob = String(step.resultForModel);
    try {
      const parsed = JSON.parse(blob);
      if (parsed?.bodyText) rawDetail = String(parsed.bodyText);
    } catch {
      const m = blob.match(/"bodyText"\s*:\s*"((?:\\.|[^"\\])*)"/);
      if (m) {
        try {
          rawDetail = JSON.parse(`"${m[1]}"`);
        } catch {
          rawDetail = m[1];
        }
      }
    }
  }
  const detail = redactSecrets(rawDetail.replace(/^\[MCP error\]\s*/i, "").trim()).slice(
    0,
    240
  );
  if (detail && isNameConflictDetail(detail)) {
    const taken = repoNameFromWriteStep(step);
    const alts = suggestRepoAltNames(taken);
    const named = taken ? ` named "${taken}"` : "";
    const suggest =
      alts.length > 0
        ? ` I can create it under a new name — for example ${alts[0]} or ${alts[1]} — if you Confirm one of those.`
        : " Tell me a different repository name and Confirm to create it.";
    if (embed) {
      return `That repository name${named ? ` (${taken})` : ""} is already taken on GitHub.${suggest} I will not invent a success.`;
    }
    return `A repository${named} already exists on this GitHub account.${suggest} I will not invent a success URL.`;
  }
  if (!detail) {
    return embed ? GITHUB_WRITE_REFUSE_EMBED : GITHUB_WRITE_REFUSE_STUDIO;
  }
  if (embed) {
    return `I couldn't complete that GitHub change. ${detail} I will not invent a success.`;
  }
  return `I couldn't complete that GitHub repository change with the connected MCP tools. ${detail} I will not invent a success URL.`;
}

export {
  GITHUB_INVENTORY_REFUSE_STUDIO,
  GITHUB_INVENTORY_REFUSE_EMBED,
  GITHUB_MCP_AUTH_REFUSE_STUDIO,
  GITHUB_MCP_AUTH_REFUSE_EMBED,
  GITHUB_WRITE_REFUSE_STUDIO,
  GITHUB_WRITE_REFUSE_EMBED,
};
