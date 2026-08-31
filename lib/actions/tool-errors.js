/**
 * F11 Phase D — error classification + model-safe tool result formatting.
 */
import { sanitizeToolBodyForModel } from "./response-sanitize.js";

/** HTTP statuses that may get one automatic retry. */
export function isRetryableHttpStatus(httpStatus) {
  const n = Number(httpStatus);
  return Number.isFinite(n) && n >= 500 && n <= 599;
}

/**
 * Whether an executeHttpAction result should be retried once.
 * 4xx / SSRF / schema → never. Timeout / 5xx / fetch error → candidate.
 * Method/risk: GET/READ always eligible; WRITE/POST only when idempotent.
 */
export function shouldRetryHttpAction(result, opts = {}) {
  if (!result || result.ok) return false;
  const method = String(opts.method || "GET").toUpperCase();
  const risk = String(opts.riskLevel || "READ").toUpperCase();
  const idempotent = opts.idempotent !== false;

  const isWrite =
    method === "POST" || risk === "WRITE" || risk === "DESTRUCTIVE";
  if (isWrite && !idempotent) return false;

  if (result.status === "TIMEOUT") return true;
  if (result.errorCode === "TIMEOUT") return true;
  if (result.errorCode === "FETCH_ERROR") return true;
  if (isRetryableHttpStatus(result.httpStatus)) return true;
  return false;
}

/**
 * Short, non-PII message for the model (and studio timeline).
 */
export function safeToolErrorMessage(result) {
  if (!result) return "Action failed";
  const code = result.errorCode || result.status;
  if (code === "SSRF_BLOCKED" || result.status === "SSRF_BLOCKED") {
    return "This URL is not allowed";
  }
  if (code === "SCHEMA_INVALID" || result.status === "SCHEMA_INVALID") {
    return result.bodyText || "Invalid arguments for this action";
  }
  if (code === "TIMEOUT" || result.status === "TIMEOUT") {
    return "The live system timed out. Apologize briefly and suggest trying again.";
  }
  if (code === "RATE_LIMITED") {
    return "Too many action calls. Ask the user to try again shortly.";
  }
  if (code === "CONCURRENCY_LIMIT") {
    return "The live system is busy. Ask the user to try again in a moment.";
  }
  if (code === "DAILY_LIMIT") {
    return "This workspace has reached today's live lookup limit. Ask the user to try again tomorrow or contact support.";
  }
  if (code === "DISABLED" || code === "UNKNOWN_TOOL" || code === "ACTION_STALE") {
    return "This action is unavailable. Answer from knowledge or ask a clarifying question.";
  }
  if (code === "IDENTITY_REQUIRED") {
    return "This action needs the customer to be signed in. Ask them to sign in, then retry.";
  }
  if (code === "CONFIRMATION_REQUIRED") {
    return "This action needs explicit user confirmation. A Confirm button is shown in chat — tell the user what will happen and wait; do not invent success.";
  }
  if (code === "CROSS_USER_DENIED") {
    return "Refuse: the user asked for someone else's data. Say you can only help with their own account. Do not call tools or invent data.";
  }
  if (code === "END_USER_TOKEN_REQUIRED") {
    return "This action needs the visitor access token (site login / setUser). Ask them to sign in, then retry.";
  }
  if (code === "CREDENTIAL_REVOKED" || code === "CREDENTIAL_MISSING") {
    return "Live credentials are unavailable. Answer from knowledge or suggest contacting support.";
  }
  if (code === "MAX_STEPS") {
    return "Tool step limit reached. Ask the user to clarify what they need.";
  }
  const http = Number(result.httpStatus);
  if (http === 401) {
    return "Live system returned 401 Unauthorized. For public Brandly tools, the owner must attach an API-key credential (X-API-KEY) on the HTTP tool. For private 'my …' tools, the visitor must be signed in via setUser. Do not invent data.";
  }
  if (http === 403) {
    return "Live system returned 403 Forbidden — the API key may lack the required scope, or the user is not allowed. Do not invent data.";
  }
  if (http >= 400 && http < 500) {
    return `Live system returned HTTP ${http}. Tell the user you could not complete the lookup; do not invent data.`;
  }
  if (http >= 500) {
    return "The live system is temporarily unavailable. Apologize briefly and suggest trying again later.";
  }
  return "The live lookup failed. Apologize briefly; do not invent results.";
}

/**
 * Payload fed back to the LLM after a tool call — no long PII bodies on errors.
 * For Brandly campaign tools, slim the body so the model cannot dump the full profile.
 * @param {object} result — executeHttpAction result
 * @param {{ maxOkBody?: number, maxErrorDetail?: number, actionName?: string, guest?: boolean }} [opts]
 */
export function formatToolResultForModel(result, opts = {}) {
  const guest = Boolean(opts.guest);
  const maxOkBody = opts.maxOkBody ?? (guest ? 1200 : 2000);
  const maxErrorDetail = opts.maxErrorDetail ?? 400;

  if (result?.ok) {
    let body = String(result.bodyText || "");
    body = slimToolBodyForModel(opts.actionName, body);
    body = sanitizeToolBodyForModel(body, { guest, maxChars: maxOkBody });
    const truncated = body.length > maxOkBody || Boolean(result.truncated);
    return JSON.stringify({
      ok: true,
      httpStatus: result.httpStatus,
      body: truncated ? `${body.slice(0, maxOkBody)}…` : body,
      truncated,
      retried: Boolean(result.retried),
      replyHint: guest
        ? "Guest path: never reveal emails, phones, addresses, or other personal details. Status/ETA only."
        : "Answer ONLY what the user asked. If they asked for status, give status (and name) only — no extra fields.",
    });
  }

  const http = Number(result?.httpStatus);
  const includeDetail = http >= 400 && http < 500;
  const detailRaw = includeDetail ? String(result?.bodyText || "") : "";
  const detail =
    detailRaw.length > maxErrorDetail
      ? `${detailRaw.slice(0, maxErrorDetail)}…`
      : detailRaw || undefined;

  return JSON.stringify({
    ok: false,
    status: result?.status || "ERROR",
    httpStatus: result?.httpStatus ?? null,
    errorCode: result?.errorCode || null,
    error: safeToolErrorMessage(result),
    retried: Boolean(result?.retried),
    ...(detail ? { detail } : {}),
  });
}

/**
 * Reduce Brandly campaign payloads so the LLM only sees status-relevant fields.
 */
export function slimToolBodyForModel(actionName, bodyText) {
  const name = String(actionName || "");
  if (
    name !== "get_brandly_campaign" &&
    name !== "list_brandly_campaigns" &&
    name !== "get_campaign_status"
  ) {
    return bodyText;
  }

  try {
    const parsed = JSON.parse(bodyText);
    const data = parsed?.data ?? parsed;

    if (name === "list_brandly_campaigns") {
      const list = data?.campaigns || (Array.isArray(data) ? data : []);
      const slim = (Array.isArray(list) ? list : []).slice(0, 5).map((c) => ({
        _id: c._id || c.id,
        name: c.name,
        status: c.status,
      }));
      return JSON.stringify({ campaigns: slim });
    }

    const campaign = data?.campaign || data;
    if (campaign && typeof campaign === "object") {
      return JSON.stringify({
        _id: campaign._id || campaign.id,
        name: campaign.name,
        status: campaign.status,
      });
    }
  } catch {
    // keep original body
  }
  return bodyText;
}
