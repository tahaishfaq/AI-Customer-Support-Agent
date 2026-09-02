/**
 * O01 — Map F11/F14 policy + tool error codes → CapabilityResult status / client type.
 * Deterministic; LLM is never the PEP.
 * @see docs/features/ORCHESTRATOR_CONTRACT.md
 */

/** @typedef {"ok"|"denied"|"needs_user"|"error"|"escalate"} CapabilityStatus */
/** @typedef {"none"|"confirm"|"login"|"handoff"|"data"} ClientActionType */

/**
 * @type {Record<string, { status: CapabilityStatus, clientType: ClientActionType }>}
 */
export const POLICY_CODE_MAP = Object.freeze({
  OK: { status: "ok", clientType: "none" },
  CONFIRMATION_REQUIRED: { status: "needs_user", clientType: "confirm" },
  IDENTITY_REQUIRED: { status: "needs_user", clientType: "login" },
  END_USER_TOKEN_REQUIRED: { status: "needs_user", clientType: "login" },
  CROSS_USER_DENIED: { status: "denied", clientType: "none" },
  POLICY_DENIED: { status: "denied", clientType: "none" },
  // Transport / invoke failures
  SCHEMA_INVALID: { status: "error", clientType: "none" },
  UNKNOWN_TOOL: { status: "error", clientType: "none" },
  DISABLED: { status: "error", clientType: "none" },
  MAX_STEPS: { status: "error", clientType: "none" },
  RATE_LIMITED: { status: "error", clientType: "none" },
  DAILY_LIMIT: { status: "error", clientType: "none" },
  CONCURRENCY_LIMIT: { status: "error", clientType: "none" },
  SSRF_BLOCKED: { status: "error", clientType: "none" },
  CREDENTIAL_MISSING: { status: "error", clientType: "none" },
  CREDENTIAL_REVOKED: { status: "error", clientType: "none" },
  ACTION_STALE: { status: "error", clientType: "none" },
  FETCH_ERROR: { status: "error", clientType: "none" },
  HTTP_ERROR: { status: "error", clientType: "none" },
  MCP_ERROR: { status: "error", clientType: "none" },
  CACHE_HIT: { status: "ok", clientType: "data" },
  TIMEOUT: { status: "error", clientType: "none" },
  ESCALATE: { status: "escalate", clientType: "handoff" },
  HANDOFF: { status: "escalate", clientType: "handoff" },
});

/**
 * @param {string|null|undefined} code
 * @param {{ httpOk?: boolean }} [opts]
 * @returns {{ status: CapabilityStatus, clientType: ClientActionType }}
 */
export function mapPolicyCodeToCapability(code, opts = {}) {
  const key = String(code || "").trim().toUpperCase();
  if (!key && opts.httpOk) {
    return { status: "ok", clientType: "data" };
  }
  if (POLICY_CODE_MAP[key]) {
    return { ...POLICY_CODE_MAP[key] };
  }
  // Unknown codes fail closed as error (safe for model).
  return { status: "error", clientType: "none" };
}
