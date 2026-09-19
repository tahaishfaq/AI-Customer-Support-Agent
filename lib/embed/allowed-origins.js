/**
 * Customization features.allowedOriginsMode / allowedOrigins enforcement.
 * Complements Agent.siteKnowledgeOrigin lock — does not replace it.
 */

/**
 * @param {string} raw
 * @returns {string|null} normalized origin (scheme://host[:port])
 */
export function normalizeOriginEntry(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  try {
    const withProto = /^https?:\/\//i.test(text) ? text : `https://${text}`;
    return new URL(withProto).origin;
  } catch {
    return null;
  }
}

/**
 * @param {string} text — newline or comma separated
 * @returns {string[]}
 */
export function parseAllowedOriginsList(text) {
  const parts = String(text || "").split(/[\n,]+/);
  const out = [];
  const seen = new Set();
  for (const part of parts) {
    const origin = normalizeOriginEntry(part);
    if (!origin || seen.has(origin)) continue;
    seen.add(origin);
    out.push(origin);
  }
  return out;
}

/**
 * @param {unknown} customization
 * @returns {{ mode: "all"|"allowlist", list: string[] }}
 */
export function readAllowedOriginsConfig(customization) {
  const features =
    customization &&
    typeof customization === "object" &&
    customization.features &&
    typeof customization.features === "object"
      ? customization.features
      : {};
  const mode =
    String(features.allowedOriginsMode || "all").toLowerCase() === "allowlist"
      ? "allowlist"
      : "all";
  return {
    mode,
    list: parseAllowedOriginsList(features.allowedOrigins),
  };
}

/**
 * @param {{
 *   mode: "all"|"allowlist",
 *   list: string[],
 *   requestOrigin?: string|null,
 *   skipReason?: string|null,
 * }} opts
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function evaluateAllowedOriginsGate({
  mode = "all",
  list = [],
  requestOrigin = null,
  skipReason = null,
} = {}) {
  if (mode !== "allowlist") return { ok: true };

  // Studio / local preview / own product — same carve-out as siteKnowledgeOrigin.
  if (skipReason === "localhost" || skipReason === "own-product") {
    return { ok: true };
  }

  if (!requestOrigin) {
    return { ok: false, reason: "origin_required" };
  }

  let normalized;
  try {
    normalized = new URL(String(requestOrigin)).origin;
  } catch {
    return { ok: false, reason: "origin_invalid" };
  }

  if (!list.length) {
    return { ok: false, reason: "allowlist_empty" };
  }

  if (!list.includes(normalized)) {
    return { ok: false, reason: "origin_not_allowlisted" };
  }

  return { ok: true };
}

/**
 * Gate for a loaded agent + crawl decision from shouldSkipCrawlOrigin.
 * @param {{ customization?: unknown, siteKnowledgeOrigin?: string|null }} agent
 * @param {{ skip?: boolean, reason?: string, origin?: string }|null} decision
 * @param {string} [rawOrigin]
 */
export function assertAgentAllowedOrigin(agent, decision, rawOrigin = "") {
  const { mode, list } = readAllowedOriginsConfig(agent?.customization);
  const requestOrigin =
    decision?.origin ||
    (rawOrigin ? normalizeOriginEntry(rawOrigin) : null) ||
    null;
  const skipReason = decision?.skip ? decision.reason : null;
  return evaluateAllowedOriginsGate({
    mode,
    list,
    requestOrigin,
    skipReason,
  });
}
