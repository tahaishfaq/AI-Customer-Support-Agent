/**
 * Phase 3 — compact grounding evidence.
 *
 * Evidence is an audit/debug contract, never an authorization source. The
 * model, retrieved text, and external results cannot change these fields.
 */

export const EVIDENCE_STATES = Object.freeze({
  SUCCESS: "SUCCESS",
  EMPTY: "EMPTY",
  PARTIAL: "PARTIAL",
  UNAVAILABLE: "UNAVAILABLE",
  DENIED: "DENIED",
});

/**
 * @param {{
 *   used?: Array<{id?: string, name?: string, type?: string, sourceUrl?: string, origin?: string}>,
 *   docs?: Array<{id?: string, createdAt?: Date|string|null, updatedAt?: Date|string|null}>,
 *   route?: string,
 *   retrievedAt?: Date|string,
 *   crawlStatus?: string|null,
 *   crawlStale?: boolean,
 * }} input
 */
export function buildKnowledgeEvidence({
  used = [],
  docs = [],
  route = "GENERAL",
  retrievedAt = new Date(),
  crawlStatus = null,
  crawlStale = false,
} = {}) {
  const selected = Array.isArray(used) ? used.filter((item) => item?.id) : [];
  const docById = new Map(
    (Array.isArray(docs) ? docs : [])
      .filter((doc) => doc?.id)
      .map((doc) => [String(doc.id), doc])
  );
  const status = selected.length
    ? crawlStale || String(crawlStatus || "").toUpperCase() === "PARTIAL"
      ? EVIDENCE_STATES.PARTIAL
      : EVIDENCE_STATES.SUCCESS
    : docs.length
      ? crawlStale || String(crawlStatus || "").toUpperCase() === "PARTIAL"
        ? EVIDENCE_STATES.PARTIAL
        : EVIDENCE_STATES.EMPTY
      : EVIDENCE_STATES.UNAVAILABLE;

  return {
    state: status,
    route: String(route || "GENERAL").toUpperCase(),
    permissionScope: "AGENT_KNOWLEDGE",
    binding: { agentBound: true, customerBound: false },
    retrievalTime: new Date(retrievedAt).toISOString(),
    configVersion: "knowledge-lexical-v1",
    sources: selected.map((item) => {
      const doc = docById.get(String(item.id));
      return {
        sourceId: String(item.id),
        title: String(item.name || doc?.name || "Knowledge").slice(0, 200),
        type: String(item.type || doc?.type || "TEXT").toUpperCase(),
        claimCoverage: "SELECTED_CHUNK",
        sourceTime: toIso(doc?.updatedAt || doc?.createdAt || null),
        ...(item.sourceUrl || item.origin
          ? { origin: String(item.sourceUrl || item.origin).slice(0, 500) }
          : {}),
      };
    }),
  };
}

/**
 * Build safe evidence for a capability result. Authorization is performed by
 * the gateway; these flags describe that boundary and do not grant access.
 * @param {{
 *   action?: {id?: string, agentId?: string, accessClass?: string, riskLevel?: string, responseProjectionJson?: object, _mcp?: unknown, _builtin?: unknown},
 *   step?: {status?: string, errorCode?: string|null, httpStatus?: number|null},
 *   agentId?: string|null,
 *   conversationId?: string|null,
 *   route?: string,
 * }} input
 */
export function buildCapabilityEvidence({
  action = null,
  step = {},
  agentId = null,
  conversationId = null,
  route = "GENERAL",
} = {}) {
  const projection = action?.responseProjectionJson;
  const fields = Array.isArray(projection?.fields)
    ? projection.fields.map((field) => String(field)).slice(0, 50)
    : [];
  const sourceType = action?._builtin
    ? "BUILTIN"
    : action?._mcp
      ? "MCP"
      : "HTTP";
  const status = String(step?.status || step?.errorCode || "UNKNOWN").toUpperCase();
  return {
    state: status === "OK" || status === "CACHE_HIT" ? EVIDENCE_STATES.SUCCESS : "ERROR",
    sourceId: String(action?.id || action?.name || "unknown"),
    sourceType,
    route: String(route || "GENERAL").toUpperCase(),
    permissionScope: String(action?.accessClass || "UNKNOWN").toUpperCase(),
    binding: {
      agentBound: Boolean(agentId && action?.agentId === agentId),
      conversationBound: Boolean(conversationId),
      customerBound: String(action?.identityMode || "NONE").toUpperCase() === "END_USER_TOKEN",
    },
    response: {
      status,
      httpStatus: step?.httpStatus == null ? null : Number(step.httpStatus),
      claimCoverage: fields.length ? "PROJECTED_FIELDS" : status === "OK" ? "VALIDATED_RESULT" : "NONE",
      fields,
    },
    configVersion: Number(action?.version) || 1,
    retrievedAt: new Date().toISOString(),
  };
}

/**
 * Reject an upstream response that explicitly identifies another customer.
 * Missing identity fields are allowed because many public APIs do not return
 * them; only an explicit mismatch fails closed.
 * @param {{bodyText?: string, action?: object, customerSubject?: string|null}} input
 */
export function validateCapabilityResultBinding({
  bodyText = "",
  action = null,
  customerSubject = null,
} = {}) {
  if (!customerSubject || String(action?.identityMode || "").toUpperCase() !== "END_USER_TOKEN") {
    return { ok: true, checked: false };
  }
  let parsed;
  try {
    parsed = JSON.parse(String(bodyText || ""));
  } catch {
    return { ok: true, checked: false };
  }
  const identityValues = [];
  collectIdentityValues(parsed, identityValues);
  const expected = String(customerSubject).trim().toLowerCase();
  const mismatch = identityValues.find(
    (value) => String(value).trim().toLowerCase() !== expected
  );
  if (mismatch !== undefined) {
    return {
      ok: false,
      checked: true,
      errorCode: "RESULT_BINDING_MISMATCH",
      error: "The live response did not match the verified customer.",
    };
  }
  return { ok: true, checked: true };
}

function collectIdentityValues(value, output) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectIdentityValues(item, output));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (/^(customerId|customer_id|userId|user_id|subject)$/i.test(key)) {
      if (nested != null && typeof nested !== "object") output.push(nested);
    } else {
      collectIdentityValues(nested, output);
    }
  }
}

function toIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
