/**
 * F11 — HTTP action executor (R3: credentials, DNS pin, method-aware retry, output cap).
 */
import { randomUUID } from "node:crypto";
import {
  DEFAULT_ACTION_TIMEOUT_MS,
  clampActionTimeoutMs,
  isEnvSecretRef,
} from "./action-config.js";
import { assertActionUrlSafe, assertActionUrlSafePinned } from "./ssrf.js";
import { assertFrozenHostMatch } from "./frozen-host.js";
import { applyCredentialToHeaders } from "./credential-apply.js";
import { shouldRetryHttpAction } from "./tool-errors.js";

export const MAX_RESPONSE_CHARS = 8000;
/** Guest / public paths — tighter cap before LLM. */
export const MAX_GUEST_RESPONSE_CHARS = 1200;
const RETRY_DELAY_MS = 250;

function httpError(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

/**
 * Replace {{key}} from args; {{env:NAME}} from process.env;
 * {{credential:name}} from credentialByName map.
 */
export function resolveTemplate(
  template,
  args = {},
  { encode = true, credentialByName = {} } = {}
) {
  return String(template || "").replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, rawKey) => {
    const key = String(rawKey || "").trim();
    if (key.startsWith("env:")) {
      if (!isEnvSecretRef(key)) {
        throw httpError(400, `Invalid env secret ref: ${key}`, "SCHEMA_INVALID");
      }
      const envName = key.slice(4);
      const value = process.env[envName];
      if (value == null || value === "") {
        throw httpError(400, `Missing env secret: ${envName}`, "SCHEMA_INVALID");
      }
      return String(value);
    }
    if (key.toLowerCase().startsWith("credential:")) {
      const name = key.slice("credential:".length).trim().toLowerCase();
      const c = credentialByName[name];
      if (!c?.plaintext) {
        throw httpError(400, `Missing credential: ${name}`, "SCHEMA_INVALID");
      }
      return String(c.plaintext);
    }
    if (!Object.prototype.hasOwnProperty.call(args, key)) {
      throw httpError(400, `Missing argument: ${key}`, "SCHEMA_INVALID");
    }
    const value = args[key];
    if (value == null) {
      throw httpError(400, `Missing argument: ${key}`, "SCHEMA_INVALID");
    }
    const text = String(value);
    return encode ? encodeURIComponent(text) : text;
  });
}

export function resolveHeaders(headersJson, args = {}, { credentialByName = {} } = {}) {
  const out = {};
  const source =
    headersJson && typeof headersJson === "object" && !Array.isArray(headersJson)
      ? headersJson
      : {};
  for (const [key, raw] of Object.entries(source)) {
    out[key] = resolveTemplate(String(raw ?? ""), args, {
      encode: false,
      credentialByName,
    });
  }
  return out;
}

/**
 * Light output schema check: if schema is { key: "type" }, required keys must exist.
 */
export function validateOutputAgainstSchema(bodyText, outputSchemaJson) {
  if (!outputSchemaJson || typeof outputSchemaJson !== "object" || Array.isArray(outputSchemaJson)) {
    return { ok: true };
  }
  const keys = Object.keys(outputSchemaJson);
  if (!keys.length) return { ok: true };

  let parsed;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return { ok: false, error: "Response is not JSON matching output schema" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "Response JSON must be an object" };
  }
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(parsed, key)) {
      return { ok: false, error: `Missing required output field: ${key}` };
    }
  }
  return { ok: true };
}

function demoOrderFromPath(pathname) {
  const match = String(pathname || "").match(/\/api\/demo\/orders\/([^/]+)\/?$/i);
  if (!match) return null;
  const id = decodeURIComponent(match[1]);
  const catalog = {
    "ORD-100": {
      id: "ORD-100",
      status: "Shipped",
      carrier: "DHL",
      eta: "Tuesday",
    },
    "ORD-999": {
      id: "ORD-999",
      status: "Out for delivery",
      carrier: "Local",
      eta: "Today",
    },
    "PCL-100": {
      id: "PCL-100",
      status: "Out for delivery",
      carrier: "AIDE Courier",
      eta: "Today 4–6pm",
      servicePoint: "Locker #12 — Main St",
    },
    "PCL-200": {
      id: "PCL-200",
      status: "Delivered",
      carrier: "AIDE Courier",
      eta: "Delivered yesterday",
      servicePoint: null,
    },
  };
  return (
    catalog[id] || {
      id,
      status: "Processing",
      carrier: null,
      eta: null,
    }
  );
}

/** Brandly-style campaign demo (in-process; same pattern as orders). */
function demoCampaignFromPath(pathname) {
  const match = String(pathname || "").match(
    /\/api\/demo\/campaigns\/([^/]+)\/?$/i
  );
  if (!match) return null;
  const id = decodeURIComponent(match[1]);
  const catalog = {
    "CAMP-100": {
      id: "CAMP-100",
      name: "Summer Creator Drop",
      status: "ACTIVE",
      niche: "Fashion",
      budgetUsd: 5000,
      matchedCreators: 8,
      pendingRequests: 2,
      brand: "Brandly Demo Co",
    },
    "CAMP-200": {
      id: "CAMP-200",
      name: "Product Launch Week",
      status: "DRAFT",
      niche: "Beauty",
      budgetUsd: 2500,
      matchedCreators: 0,
      pendingRequests: 0,
      brand: "Brandly Demo Co",
    },
    "CAMP-999": {
      id: "CAMP-999",
      name: "Holiday Collab",
      status: "COMPLETED",
      niche: "Lifestyle",
      budgetUsd: 12000,
      matchedCreators: 15,
      pendingRequests: 0,
      brand: "Brandly Demo Co",
    },
  };
  return (
    catalog[id] || {
      id,
      name: null,
      status: "UNKNOWN",
      niche: null,
      budgetUsd: null,
      matchedCreators: 0,
      pendingRequests: 0,
      brand: null,
    }
  );
}

/**
 * Execute allowlisted HTTP action. Never logs secrets.
 */
export async function executeHttpAction({
  method = "GET",
  urlTemplate,
  headersJson = null,
  args = {},
  timeoutMs = DEFAULT_ACTION_TIMEOUT_MS,
  allowLocalDemo = false,
  retryOnce = true,
  credential = null,
  frozenHost = null,
  outputSchemaJson = null,
  idempotent = true,
  riskLevel = "READ",
  endUserAccessToken = null,
  preferEndUserAuth = false,
  /** When true, truncate HTTP body to MAX_GUEST_RESPONSE_CHARS before schema check / return. */
  guestResponseCap = false,
}) {
  const verb = String(method || "GET").toUpperCase() === "POST" ? "POST" : "GET";
  const risk = String(riskLevel || "READ").toUpperCase();
  const maxChars = guestResponseCap
    ? MAX_GUEST_RESPONSE_CHARS
    : MAX_RESPONSE_CHARS;

  const first = await executeHttpActionOnce({
    method: verb,
    urlTemplate,
    headersJson,
    args,
    timeoutMs,
    allowLocalDemo,
    credential,
    frozenHost,
    outputSchemaJson,
    idempotent,
    riskLevel: risk,
    endUserAccessToken,
    preferEndUserAuth,
    maxResponseChars: maxChars,
  });

  const canRetry =
    retryOnce &&
    shouldRetryHttpAction(first, { method: verb, riskLevel: risk, idempotent }) &&
    allowRetryForMethod({ method: verb, riskLevel: risk, idempotent, headers: first.requestHeaders });

  if (!canRetry) {
    return { ...first, retried: false };
  }

  await sleep(RETRY_DELAY_MS);
  const second = await executeHttpActionOnce({
    method: verb,
    urlTemplate,
    headersJson,
    args,
    timeoutMs,
    allowLocalDemo,
    credential,
    frozenHost,
    outputSchemaJson,
    idempotent,
    riskLevel: risk,
    idempotencyKey: first.idempotencyKey,
    endUserAccessToken,
    preferEndUserAuth,
    maxResponseChars: maxChars,
  });
  return {
    ...second,
    retried: true,
    durationMs: (first.durationMs || 0) + (second.durationMs || 0),
  };
}

function allowRetryForMethod({ method, riskLevel, idempotent, headers }) {
  const verb = String(method || "GET").toUpperCase();
  const risk = String(riskLevel || "READ").toUpperCase();
  if (verb === "GET" || risk === "READ") return true;
  if (idempotent === true) {
    const key =
      headers?.["Idempotency-Key"] ||
      headers?.["idempotency-key"];
    return Boolean(key);
  }
  return false;
}

async function executeHttpActionOnce({
  method = "GET",
  urlTemplate,
  headersJson = null,
  args = {},
  timeoutMs = DEFAULT_ACTION_TIMEOUT_MS,
  allowLocalDemo = false,
  credential = null,
  frozenHost = null,
  outputSchemaJson = null,
  idempotent = true,
  riskLevel = "READ",
  idempotencyKey = null,
  endUserAccessToken = null,
  preferEndUserAuth = false,
  maxResponseChars = MAX_RESPONSE_CHARS,
}) {
  const started = Date.now();
  const verb = String(method || "GET").toUpperCase() === "POST" ? "POST" : "GET";
  const credentialByName = {};
  if (credential?.name && credential?.plaintext) {
    credentialByName[String(credential.name).toLowerCase()] = credential;
  }

  let urlString;
  try {
    urlString = resolveTemplate(urlTemplate, args, { credentialByName });
  } catch (err) {
    return {
      ok: false,
      status: TOOL_STATUS_FROM_CODE(err.code),
      httpStatus: null,
      durationMs: Date.now() - started,
      errorCode: err.code || "SCHEMA_INVALID",
      bodyText: err.message,
      truncated: false,
    };
  }

  let parsed;
  try {
    parsed = new URL(urlString);
  } catch {
    return {
      ok: false,
      status: "SSRF_BLOCKED",
      httpStatus: null,
      durationMs: Date.now() - started,
      errorCode: "SSRF_BLOCKED",
      bodyText: "Invalid URL after template resolve",
      truncated: false,
    };
  }

  try {
    assertFrozenHostMatch(urlString, frozenHost);
  } catch (err) {
    return {
      ok: false,
      status: "SSRF_BLOCKED",
      httpStatus: null,
      durationMs: Date.now() - started,
      errorCode: "SSRF_BLOCKED",
      bodyText: err.message || "Frozen host mismatch",
      truncated: false,
    };
  }

  const demo =
    demoOrderFromPath(parsed.pathname) || demoCampaignFromPath(parsed.pathname);
  if (demo && isLocalDemoHost(parsed)) {
    const bodyText = JSON.stringify(demo);
    return {
      ok: true,
      status: "OK",
      httpStatus: 200,
      durationMs: Date.now() - started,
      errorCode: null,
      bodyText,
      truncated: false,
      demo: true,
    };
  }

  try {
    await assertActionUrlSafePinned(urlString, { allowLocalDemo });
  } catch (err) {
    // Fallback sync check still records SSRF
    try {
      assertActionUrlSafe(urlString, { allowLocalDemo });
    } catch {
      /* ignore */
    }
    return {
      ok: false,
      status: "SSRF_BLOCKED",
      httpStatus: null,
      durationMs: Date.now() - started,
      errorCode: "SSRF_BLOCKED",
      bodyText: err.message || "URL blocked",
      truncated: false,
    };
  }

  let headers;
  try {
    headers = resolveHeaders(headersJson, args, { credentialByName });
    headers = applyCredentialToHeaders(headers, credential, {
      credentialByName,
      endUserAccessToken,
      preferEndUserAuth,
    });
  } catch (err) {
    return {
      ok: false,
      status: TOOL_STATUS_FROM_CODE(err.code),
      httpStatus: null,
      durationMs: Date.now() - started,
      errorCode: err.code || "SCHEMA_INVALID",
      bodyText: err.message,
      truncated: false,
    };
  }

  const risk = String(riskLevel || "READ").toUpperCase();
  let key = idempotencyKey;
  if (
    verb === "POST" &&
    (risk === "WRITE" || risk === "DESTRUCTIVE" || idempotent === true) &&
    idempotent === true
  ) {
    const existing =
      headers["Idempotency-Key"] || headers["idempotency-key"];
    if (!existing) {
      key = key || randomUUID();
      headers["Idempotency-Key"] = key;
    } else {
      key = existing;
    }
  }

  const controller = new AbortController();
  const ms = clampActionTimeoutMs(timeoutMs);
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    const response = await fetch(urlString, {
      method: verb,
      headers: {
        Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
        ...headers,
      },
      signal: controller.signal,
      redirect: "manual",
    });

    const raw = await response.text();
    const cap = Number(maxResponseChars) > 0 ? Number(maxResponseChars) : MAX_RESPONSE_CHARS;
    const truncated = raw.length > cap;
    let bodyText = truncated ? raw.slice(0, cap) : raw;
    const ok = response.status >= 200 && response.status < 300;

    if (ok && outputSchemaJson) {
      const schemaCheck = validateOutputAgainstSchema(bodyText, outputSchemaJson);
      if (!schemaCheck.ok) {
        return {
          ok: false,
          status: "ERROR",
          httpStatus: response.status,
          durationMs: Date.now() - started,
          errorCode: "OUTPUT_SCHEMA_INVALID",
          bodyText: schemaCheck.error,
          truncated,
          requestHeaders: headers,
          idempotencyKey: key,
        };
      }
    }

    return {
      ok,
      status: ok ? "OK" : "ERROR",
      httpStatus: response.status,
      durationMs: Date.now() - started,
      errorCode: ok ? null : `HTTP_${response.status}`,
      bodyText,
      truncated,
      requestHeaders: headers,
      idempotencyKey: key,
    };
  } catch (err) {
    const aborted = err?.name === "AbortError";
    return {
      ok: false,
      status: aborted ? "TIMEOUT" : "ERROR",
      httpStatus: null,
      durationMs: Date.now() - started,
      errorCode: aborted ? "TIMEOUT" : "FETCH_ERROR",
      bodyText: aborted ? `Timed out after ${ms}ms` : "Request failed",
      truncated: false,
      requestHeaders: headers,
      idempotencyKey: key,
    };
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLocalDemoHost(parsed) {
  return (
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1"
  );
}

function TOOL_STATUS_FROM_CODE(code) {
  if (code === "SSRF_BLOCKED") return "SSRF_BLOCKED";
  if (code === "SCHEMA_INVALID") return "SCHEMA_INVALID";
  if (code === "TIMEOUT") return "TIMEOUT";
  return "ERROR";
}
