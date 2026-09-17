/**
 * Managed connector ids and shared helpers.
 * Connectors build trusted HTTP requests and call executeHttpAction —
 * the LLM never supplies hosts, tokens, or auth headers.
 */

export const CONNECTOR_IDS = Object.freeze({
  SHOPIFY_ADMIN: "shopify_admin",
});

/** Action name → connector id (explicit allowlist). */
export const ACTION_CONNECTOR_BY_NAME = Object.freeze({
  shopify_get_order: CONNECTOR_IDS.SHOPIFY_ADMIN,
});

/**
 * @param {{ name?: string }|null|undefined} action
 * @returns {string|null}
 */
export function resolveConnectorId(action) {
  const name = String(action?.name || "").trim();
  return ACTION_CONNECTOR_BY_NAME[name] || null;
}

/**
 * Remove known secret substrings from tool result text before model fencing.
 * @param {object} result
 * @param {string[]} secrets
 */
export function scrubSecretsFromResult(result, secrets = []) {
  if (!result || typeof result !== "object") return result;
  const list = (Array.isArray(secrets) ? secrets : [])
    .map((s) => String(s || "").trim())
    .filter((s) => s.length >= 8);
  if (!list.length) return result;

  const scrub = (text) => {
    let out = String(text ?? "");
    for (const secret of list) {
      if (out.includes(secret)) {
        out = out.split(secret).join("[redacted-secret]");
      }
    }
    return out;
  };

  return {
    ...result,
    bodyText: scrub(result.bodyText),
  };
}
