/**
 * Level 2 · P6 — targeted proactive messages. Pure (runs in the widget, the preview and the server).
 * A rule shows a small bubble next to the launcher on matching pages; it never opens the chat.
 * The host page sends only its path (no query string), so rules match on the path.
 */

export const MAX_PROACTIVE_RULES = 10;
export const PROACTIVE_MESSAGE_MAX = 200;
export const PROACTIVE_PATH_MAX = 200;
export const PROACTIVE_DELAY_MAX = 600;
export const PROACTIVE_MATCHES = Object.freeze(["any", "contains", "prefix"]);
export const PROACTIVE_AUDIENCES = Object.freeze(["all", "identified", "anonymous"]);
export const PROACTIVE_FREQUENCIES = Object.freeze(["every_page", "once_per_session", "once_per_visitor"]);

const clean = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);

/** One stored rule → safe rule, or null when it cannot be shown. */
export function normalizeProactiveRule(rule, index = 0) {
  if (!rule || typeof rule !== "object") return null;
  const message = clean(rule.message, PROACTIVE_MESSAGE_MAX);
  if (!message) return null;
  const match = pick(rule.match, PROACTIVE_MATCHES, "any");
  const path = clean(rule.path, PROACTIVE_PATH_MAX).toLowerCase();
  const delay = Math.round(Number(rule.delaySeconds));
  return {
    id: /^[a-zA-Z0-9_-]{1,40}$/.test(String(rule.id || "")) ? String(rule.id) : `rule_${index + 1}`,
    enabled: rule.enabled !== false,
    message,
    // "contains" / "prefix" with no path would match everything: treat as "any".
    match: match !== "any" && !path ? "any" : match,
    path: match === "any" ? "" : path,
    delaySeconds: Number.isFinite(delay) ? Math.min(Math.max(delay, 0), PROACTIVE_DELAY_MAX) : 0,
    audience: pick(rule.audience, PROACTIVE_AUDIENCES, "all"),
    frequency: pick(rule.frequency, PROACTIVE_FREQUENCIES, "every_page"),
  };
}

/**
 * Rules from customization.deploy. The old single proactive message (proactiveEnabled +
 * proactiveMessage) is read as one "every page, everyone, no delay" rule, so nothing is lost.
 */
export function normalizeProactiveRules(deploy) {
  const d = deploy && typeof deploy === "object" ? deploy : {};
  if (Array.isArray(d.proactiveRules) && d.proactiveRules.length) {
    return d.proactiveRules
      .slice(0, MAX_PROACTIVE_RULES)
      .map((rule, index) => normalizeProactiveRule(rule, index))
      .filter(Boolean);
  }
  if (d.proactiveEnabled) {
    const legacy = normalizeProactiveRule({ id: "legacy", message: d.proactiveMessage || "Hi! Need help?" });
    return legacy ? [legacy] : [];
  }
  return [];
}

/** Path of the host page, lower-cased, without query or hash. */
export function normalizePath(path) {
  const raw = String(path || "/").split(/[?#]/)[0].trim().toLowerCase();
  return raw.startsWith("/") ? raw.slice(0, 500) : `/${raw.slice(0, 499)}`;
}

export function matchesPath(rule, path) {
  if (!rule || rule.match === "any") return true;
  const current = normalizePath(path);
  if (rule.match === "prefix") return current.startsWith(rule.path.startsWith("/") ? rule.path : `/${rule.path}`);
  return current.includes(rule.path);
}

/**
 * First enabled rule for this page and visitor that has not been used up.
 * @param {{ rules: object[], path: string, identified: boolean, seen?: { session?: Set<string>|string[], visitor?: Set<string>|string[], page?: Set<string>|string[] } }} input
 */
export function pickProactiveRule({ rules, path, identified, seen = {} }) {
  const has = (set, id) => (set instanceof Set ? set.has(id) : Array.isArray(set) && set.includes(id));
  for (const rule of Array.isArray(rules) ? rules : []) {
    if (!rule?.enabled || !matchesPath(rule, path)) continue;
    if (rule.audience === "identified" && !identified) continue;
    if (rule.audience === "anonymous" && identified) continue;
    if (rule.frequency === "once_per_visitor" && has(seen.visitor, rule.id)) continue;
    if (rule.frequency === "once_per_session" && has(seen.session, rule.id)) continue;
    // Dismissed on this page (every_page rules come back on the next page).
    if (has(seen.page, `${rule.id}@${normalizePath(path)}`)) continue;
    return rule;
  }
  return null;
}
