import { MAX_LLM_TOOL_RESULT_CHARS } from "./limits.js";

/**
 * Internal tool execution envelope (Phase 3).
 * Does NOT unify business schemas — only ok/data|error/meta.
 */

/**
 * @param {object} result — legacy HTTP/MCP/builtin invoke result
 * @param {{ protocol?: string }} [opts]
 */
export function toExecutionEnvelope(result, opts = {}) {
  const protocol = String(opts.protocol || result?.protocol || "rest").toLowerCase();
  if (!result) {
    return {
      ok: false,
      error: { code: "TOOL_ERROR", retryable: false },
      meta: { protocol, truncated: false, partial: false },
    };
  }

  const truncated = Boolean(result.truncated);
  const partial =
    Boolean(result.partial) || String(result.status || "").toUpperCase() === "PARTIAL";

  if (result.ok && (result.status === "OK" || result.status === "PARTIAL" || result.status === "NO_RESULT")) {
    let data = null;
    if (result.status === "NO_RESULT") {
      data = null;
    } else if (result.bodyText) {
      try {
        data = JSON.parse(result.bodyText);
      } catch {
        data = { text: String(result.bodyText).slice(0, MAX_LLM_TOOL_RESULT_CHARS) };
      }
    }
    return {
      ok: true,
      data,
      meta: {
        protocol,
        truncated,
        partial,
        status: result.status,
        httpStatus: result.httpStatus ?? null,
      },
    };
  }

  const code = mapSafeErrorCode(result);
  return {
    ok: false,
    error: {
      code,
      retryable: isRetryableCode(code, result),
    },
    meta: {
      protocol,
      truncated,
      partial: false,
      httpStatus: result.httpStatus ?? null,
    },
  };
}

function mapSafeErrorCode(result) {
  const raw = String(result.errorCode || result.status || "TOOL_ERROR").toUpperCase();
  const map = {
    TIMEOUT: "UPSTREAM_TIMEOUT",
    FETCH_ERROR: "UPSTREAM_BAD_RESPONSE",
    HTTP_401: "UPSTREAM_UNAUTHORIZED",
    HTTP_403: "UPSTREAM_FORBIDDEN",
    HTTP_429: "UPSTREAM_RATE_LIMITED",
    CONTENT_TYPE_INVALID: "CONTENT_TYPE_INVALID",
    NO_RESULT: "NO_RESULT",
    DISABLED: "TOOL_DISABLED",
    UNKNOWN_TOOL: "TOOL_DISABLED",
    POLICY_DENIED: "POLICY_DENIED",
    CONFIRMATION_REQUIRED: "POLICY_DENIED",
    CROSS_USER_DENIED: "POLICY_DENIED",
    SSRF_BLOCKED: "SSRF_BLOCKED",
    GRAPHQL_ERRORS: "UPSTREAM_BAD_RESPONSE",
    XML_UNSAFE: "CONTENT_TYPE_INVALID",
    RESPONSE_TOO_LARGE: "UPSTREAM_BAD_RESPONSE",
  };
  if (map[raw]) return map[raw];
  if (raw.startsWith("HTTP_5")) return "UPSTREAM_BAD_RESPONSE";
  if (raw.startsWith("HTTP_4")) return "UPSTREAM_BAD_RESPONSE";
  return raw.slice(0, 64) || "TOOL_ERROR";
}

function isRetryableCode(code, result) {
  if (code === "UPSTREAM_TIMEOUT" || code === "UPSTREAM_RATE_LIMITED") return true;
  const http = Number(result?.httpStatus);
  return Number.isFinite(http) && http >= 500 && http <= 599;
}

/**
 * Attach envelope onto a legacy result without breaking callers.
 */
export function withExecutionEnvelope(result, opts = {}) {
  if (!result || typeof result !== "object") return result;
  return {
    ...result,
    envelope: toExecutionEnvelope(result, opts),
  };
}
