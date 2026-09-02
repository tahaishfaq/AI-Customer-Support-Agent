/**
 * O01 — CapabilityResult envelope helpers + validation.
 * Orchestrator never parses ad-hoc tool JSON; everything is this shape.
 * @see docs/features/ORCHESTRATOR_CONTRACT.md
 */

export const CAPABILITY_STATUSES = Object.freeze([
  "ok",
  "denied",
  "needs_user",
  "error",
  "escalate",
]);

export const CLIENT_ACTION_TYPES = Object.freeze([
  "none",
  "confirm",
  "login",
  "handoff",
  "data",
]);

/**
 * @param {object} partial
 * @returns {{ status: string, code: string, forModel: string, forClient: object|null, meta: object }}
 */
function envelope({
  status,
  code,
  forModel,
  forClient = null,
  meta = {},
}) {
  return {
    status,
    code: String(code || status || "UNKNOWN").toUpperCase(),
    forModel: String(forModel ?? ""),
    forClient,
    meta: {
      capabilityId: String(meta.capabilityId || ""),
      latencyMs: Number(meta.latencyMs) || 0,
      ...(meta.httpStatus != null ? { httpStatus: Number(meta.httpStatus) } : {}),
      ...(meta.toolRunId ? { toolRunId: String(meta.toolRunId) } : {}),
    },
  };
}

export function ok({ code = "OK", forModel, forClient = null, meta = {} }) {
  return envelope({ status: "ok", code, forModel, forClient, meta });
}

export function denied({ code, forModel, forClient = null, meta = {} }) {
  return envelope({
    status: "denied",
    code,
    forModel,
    forClient: forClient ?? { type: "none" },
    meta,
  });
}

export function needsUser({ code, forModel, forClient, meta = {} }) {
  return envelope({
    status: "needs_user",
    code,
    forModel,
    forClient: forClient || { type: "none" },
    meta,
  });
}

export function errorResult({ code, forModel, forClient = null, meta = {} }) {
  return envelope({
    status: "error",
    code,
    forModel,
    forClient: forClient ?? { type: "none" },
    meta,
  });
}

export function escalate({ code = "ESCALATE", forModel, forClient = null, meta = {} }) {
  return envelope({
    status: "escalate",
    code,
    forModel,
    forClient: forClient ?? { type: "handoff" },
    meta,
  });
}

/**
 * @param {unknown} value
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateCapabilityResult(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "result must be an object" };
  }
  const r = /** @type {Record<string, unknown>} */ (value);
  if (!CAPABILITY_STATUSES.includes(/** @type {string} */ (r.status))) {
    return {
      ok: false,
      error: `status must be one of ${CAPABILITY_STATUSES.join("|")}`,
    };
  }
  if (typeof r.code !== "string" || !r.code.trim()) {
    return { ok: false, error: "code must be a non-empty string" };
  }
  if (typeof r.forModel !== "string") {
    return { ok: false, error: "forModel must be a string" };
  }
  if (r.forClient != null) {
    if (typeof r.forClient !== "object" || Array.isArray(r.forClient)) {
      return { ok: false, error: "forClient must be object or null" };
    }
    const t = /** @type {{ type?: string }} */ (r.forClient).type;
    if (!CLIENT_ACTION_TYPES.includes(t)) {
      return {
        ok: false,
        error: `forClient.type must be one of ${CLIENT_ACTION_TYPES.join("|")}`,
      };
    }
  }
  if (!r.meta || typeof r.meta !== "object" || Array.isArray(r.meta)) {
    return { ok: false, error: "meta must be an object" };
  }
  const meta = /** @type {Record<string, unknown>} */ (r.meta);
  if (typeof meta.capabilityId !== "string") {
    return { ok: false, error: "meta.capabilityId must be a string" };
  }
  if (typeof meta.latencyMs !== "number" || Number.isNaN(meta.latencyMs)) {
    return { ok: false, error: "meta.latencyMs must be a number" };
  }
  return { ok: true };
}
