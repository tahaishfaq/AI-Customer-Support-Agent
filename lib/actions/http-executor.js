/**
 * F11 — HTTP action executor (R3: credentials, DNS pin, method-aware retry, output cap).
 */
import { randomUUID } from "node:crypto";
import { notifyActivity } from "../chat/activity-emitter.js";
import {
  DEFAULT_ACTION_TIMEOUT_MS,
  clampActionTimeoutMs,
  isEnvSecretRef,
} from "./action-config.js";
import { assertActionUrlSafe, assertActionUrlSafePinned } from "./ssrf.js";
import { assertFrozenHostMatch } from "./frozen-host.js";
import { applyCredentialToHeaders } from "./credential-apply.js";
import { isNotFoundBodyText, shouldRetryHttpAction } from "./tool-errors.js";
import {
  normalizeProjectedResponse,
  sanitizeResponseBodyText,
  validateResponseProjection,
} from "./response-projection.js";
import { pinnedFetch } from "./pinned-fetch.js";
import {
  MAX_HTTP_PROCESSED_RESPONSE_CHARS,
  MAX_PUBLIC_HTTP_PROCESSED_RESPONSE_CHARS,
  MAX_UPSTREAM_RESPONSE_BYTES as SSOT_MAX_UPSTREAM_BYTES,
} from "./limits.js";
import {
  buildGraphQLRequestBody,
  normalizeGraphQLResponse,
} from "./graphql-adapter.js";
import { detectUnsafeGraphqlBodyInjection } from "./graphql-legacy.js";
import { isXmlContentType, parseXmlSafely } from "./xml-adapter.js";
import {
  nextPaginationStep,
  validatePaginationConfig,
} from "./pagination.js";
import { withExecutionEnvelope } from "./execution-envelope.js";

/** @deprecated import from limits.js — kept for existing importers */
export const MAX_RESPONSE_CHARS = MAX_HTTP_PROCESSED_RESPONSE_CHARS;
// Wire budget is separate from the smaller, post-projection model-output budget.
export const MAX_UPSTREAM_RESPONSE_BYTES = SSOT_MAX_UPSTREAM_BYTES;
/** Guest / public paths — tighter cap before LLM. */
export const MAX_GUEST_RESPONSE_CHARS = MAX_PUBLIC_HTTP_PROCESSED_RESPONSE_CHARS;
export const MAX_REQUEST_BODY_CHARS = 32_000;
export const MAX_REQUEST_BODY_DEPTH = 8;
const RETRY_DELAY_MS = 250;
const OMIT_VALUE = Symbol("omit-request-value");

async function readBoundedResponse(response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) return text + decoder.decode();
      bytes += value.byteLength;
      if (bytes > MAX_UPSTREAM_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {});
        throw httpError(502, "Upstream response exceeded its size limit", "RESPONSE_TOO_LARGE");
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally { reader.releaseLock(); }
}

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

function resolveBodyString(value, args) {
  const exact = String(value).match(/^\{\{\s*([^}]+?)\s*\}\}$/);
  if (exact) {
    const key = String(exact[1]).trim();
    if (!Object.prototype.hasOwnProperty.call(args, key)) return OMIT_VALUE;
    const resolved = args[key];
    if (resolved === undefined) return OMIT_VALUE;
    return resolved;
  }
  return String(value).replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, rawKey) => {
    const key = String(rawKey || "").trim();
    if (!Object.prototype.hasOwnProperty.call(args, key) || args[key] == null) {
      throw httpError(400, `Missing argument: ${key}`, "SCHEMA_INVALID");
    }
    if (typeof args[key] === "object") {
      throw httpError(400, `Argument ${key} must be scalar in a string`, "SCHEMA_INVALID");
    }
    return String(args[key]);
  });
}

export function resolveRequestBody(template, args = {}, depth = 0) {
  if (depth > MAX_REQUEST_BODY_DEPTH) {
    throw httpError(400, "Request body nesting is too deep", "SCHEMA_INVALID");
  }
  if (template === null || typeof template !== "object") {
    if (typeof template === "string") return resolveBodyString(template, args);
    return template;
  }
  if (Array.isArray(template)) {
    return template
      .map((value) => resolveRequestBody(value, args, depth + 1))
      .map((value) => (value === OMIT_VALUE ? null : value));
  }
  const out = {};
  for (const [key, value] of Object.entries(template)) {
    const resolved = resolveRequestBody(value, args, depth + 1);
    if (resolved !== OMIT_VALUE) out[key] = resolved;
  }
  return out;
}

export function serializeFormUrlEncoded(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw httpError(400, "Form body must be a JSON object", "SCHEMA_INVALID");
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, scalarFormValue(item));
    } else {
      params.append(key, scalarFormValue(value));
    }
  }
  return params.toString();
}

function scalarFormValue(value) {
  if (value === null) return "null";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function prepareRequestBody({ requestBodyTemplate, requestContentType, args }) {
  if (requestBodyTemplate == null) return { body: undefined, contentType: null };
  const resolved = resolveRequestBody(requestBodyTemplate, args);
  const type = String(requestContentType || "application/json").toLowerCase();
  const body =
    type === "application/x-www-form-urlencoded"
      ? serializeFormUrlEncoded(resolved)
      : JSON.stringify(resolved);
  if (body.length > MAX_REQUEST_BODY_CHARS) {
    throw httpError(400, "Request body is too large", "SCHEMA_INVALID");
  }
  return { body, contentType: type };
}

/**
 * Light output schema check: if schema is { key: "type" }, required keys must exist.
 */
export function validateOutputAgainstSchema(bodyText, outputSchemaJson) {
  if (!outputSchemaJson || typeof outputSchemaJson !== "object" || Array.isArray(outputSchemaJson)) {
    return { ok: true };
  }
  const schema = outputSchemaJson.type === "object"
    ? outputSchemaJson.properties || {}
    : outputSchemaJson;
  const keys = Object.keys(schema).filter((key) => key !== "required" && key !== "type");
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
    const expected = typeof schema[key] === "string"
      ? schema[key]
      : schema[key]?.type;
    if (expected && expected !== "any") {
      const actual = Array.isArray(parsed[key]) ? "array" : typeof parsed[key];
      if (actual !== expected) {
        return { ok: false, error: `Invalid output type for field: ${key}` };
      }
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
  requestContentType = "application/json",
  requestBodyTemplate = null,
  args = {},
  timeoutMs = DEFAULT_ACTION_TIMEOUT_MS,
  allowLocalDemo = false,
  retryOnce = true,
  onDispatch,
  dispatchSignal,
  credential = null,
  frozenHost = null,
  outputSchemaJson = null,
  responseProjectionJson = null,
  idempotent = true,
  riskLevel = "READ",
  endUserAccessToken = null,
  preferEndUserAuth = false,
  /** Apply the guest output cap after bounded parsing, projection, schema checks and redaction. */
  guestResponseCap = false,
  protocol = "REST_JSON",
  graphqlOperation = null,
  graphqlOperationName = null,
  paginationJson = null,
  idempotencyKey: initialIdempotencyKey = null,
}) {
  const verbRaw = String(method || "GET").toUpperCase();
  const verb = ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(verbRaw)
    ? verbRaw
    : "GET";
  const risk = String(riskLevel || "READ").toUpperCase();
  const maxChars = guestResponseCap
    ? MAX_GUEST_RESPONSE_CHARS
    : MAX_RESPONSE_CHARS;

  const onceOpts = {
    onDispatch,
    dispatchSignal,
    method: verb,
    urlTemplate,
    headersJson,
    requestContentType,
    requestBodyTemplate,
    args,
    timeoutMs,
    allowLocalDemo,
    credential,
    frozenHost,
    outputSchemaJson,
    responseProjectionJson,
    idempotent,
    riskLevel: risk,
    endUserAccessToken,
    preferEndUserAuth,
    maxResponseChars: maxChars,
    protocol,
    graphqlOperation,
    graphqlOperationName,
    paginationJson,
  };

  const first = await executeHttpActionOnce({
    ...onceOpts,
    idempotencyKey: initialIdempotencyKey || null,
  });

  // Bounded pagination (AIDE-GAP-011) — only after a successful first page.
  const pageCheck = validatePaginationConfig(paginationJson);
  if (
    pageCheck.ok &&
    pageCheck.pagination &&
    pageCheck.pagination.type !== "NONE" &&
    first.ok &&
    (first.status === "OK" || first.status === "PARTIAL")
  ) {
    const pages = [first.bodyText];
    let pageIndex = 0;
    let argsCursor = { ...args };
    let previousCursor = null;
    let last = first;
    while (pageIndex + 1 < pageCheck.pagination.maxPages) {
      const next = nextPaginationStep({
        pagination: pageCheck.pagination,
        bodyText: last.bodyText,
        pageIndex,
        previousCursor,
        args: argsCursor,
      });
      if (next.done) break;
      argsCursor = next.nextArgs || argsCursor;
      previousCursor = next.cursor ?? previousCursor;
      pageIndex += 1;
      last = await executeHttpActionOnce({
        ...onceOpts,
        args: argsCursor,
        idempotencyKey: last.idempotencyKey || null,
      });
      if (!last.ok) break;
      pages.push(last.bodyText);
    }
    if (pages.length > 1) {
      const merged = {
        ...first,
        bodyText: JSON.stringify({ pages: pages.map((p) => {
          try { return JSON.parse(p); } catch { return p; }
        }) }),
        pagesFetched: pages.length,
      };
      return withExecutionEnvelope({ ...merged, retried: false });
    }
  }

  const canRetry =
    retryOnce &&
    !dispatchSignal?.aborted &&
    shouldRetryHttpAction(first, { method: verb, riskLevel: risk, idempotent }) &&
    allowRetryForMethod({
      method: verb,
      riskLevel: risk,
      idempotent,
      headers: first.requestHeaders,
    });

  if (!canRetry) {
    return { ...first, retried: false };
  }

  await sleep(RETRY_DELAY_MS);
  const second = await executeHttpActionOnce({
    ...onceOpts,
    idempotencyKey: first.idempotencyKey,
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
  onDispatch,
  dispatchSignal,
  method = "GET",
  urlTemplate,
  headersJson = null,
  requestContentType = "application/json",
  requestBodyTemplate = null,
  args = {},
  timeoutMs = DEFAULT_ACTION_TIMEOUT_MS,
  allowLocalDemo = false,
  credential = null,
  frozenHost = null,
  outputSchemaJson = null,
  responseProjectionJson = null,
  idempotent = true,
  riskLevel = "READ",
  idempotencyKey = null,
  endUserAccessToken = null,
  preferEndUserAuth = false,
  maxResponseChars = MAX_RESPONSE_CHARS,
  protocol = "REST_JSON",
  graphqlOperation = null,
  graphqlOperationName = null,
  paginationJson = null,
}) {
  dispatchSignal?.throwIfAborted();
  const started = Date.now();
  const verbRaw = String(method || "GET").toUpperCase();
  const verb = ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(verbRaw)
    ? verbRaw
    : "GET";
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

  const protocolNorm = String(protocol || "REST_JSON").toUpperCase();

  const unsafeGql = detectUnsafeGraphqlBodyInjection({
    protocol: protocolNorm,
    urlTemplate,
    requestBodyTemplate,
  });
  if (unsafeGql.unsafe) {
    return {
      ok: false,
      status: "SCHEMA_INVALID",
      httpStatus: null,
      durationMs: Date.now() - started,
      errorCode: "GRAPHQL_CONFIG_UNSAFE",
      bodyText: unsafeGql.reason,
      truncated: false,
    };
  }

  let effectiveBodyTemplate = requestBodyTemplate;
  let effectiveContentType = requestContentType;
  let effectiveMethod = verb;
  if (protocolNorm === "GRAPHQL") {
    effectiveMethod = "POST";
    effectiveContentType = "application/json";
    effectiveBodyTemplate = buildGraphQLRequestBody({
      graphqlOperation,
      graphqlOperationName,
      variables: args,
    });
  }

  let preparedBody;
  try {
    preparedBody = prepareRequestBody({
      requestBodyTemplate: effectiveBodyTemplate,
      requestContentType: effectiveContentType,
      args: protocolNorm === "GRAPHQL" ? {} : args,
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

  // For GraphQL, body is already resolved object — stringify directly if prepare skipped templates
  if (protocolNorm === "GRAPHQL" && effectiveBodyTemplate && !preparedBody?.body) {
    preparedBody = {
      body: JSON.stringify(effectiveBodyTemplate),
      contentType: "application/json",
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
      // Same "no such record" rule as a real upstream (unknown demo id → NO_RESULT).
      status: isNotFoundBodyText(bodyText) ? "NO_RESULT" : "OK",
      httpStatus: 200,
      durationMs: Date.now() - started,
      errorCode: null,
      bodyText,
      truncated: false,
      demo: true,
    };
  }

  let pinnedAddresses = null;
  let pinnedHostname = null;
  try {
    const pinned = await assertActionUrlSafePinned(urlString, { allowLocalDemo });
    pinnedAddresses = pinned?.addresses || null;
    pinnedHostname = pinned?.parsed?.hostname || parsed.hostname;
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

  if (
    preparedBody?.contentType &&
    !Object.keys(headers).some((key) => key.toLowerCase() === "content-type")
  ) {
    headers["Content-Type"] = preparedBody.contentType;
  }

  const risk = String(riskLevel || "READ").toUpperCase();
  let key = idempotencyKey;
  const writeVerb =
    verb === "POST" || verb === "PUT" || verb === "PATCH" || verb === "DELETE";
  if (
    writeVerb &&
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
    dispatchSignal?.throwIfAborted();
    notifyActivity(onDispatch);
    const fetchInit = {
      method: effectiveMethod,
      headers: {
        Accept:
          protocolNorm === "XML"
            ? "application/xml, text/xml, application/json;q=0.8, */*;q=0.5"
            : "application/json, text/plain;q=0.9, */*;q=0.8",
        ...headers,
      },
      ...(preparedBody?.body !== undefined ? { body: preparedBody.body } : {}),
      signal: controller.signal,
      redirect: "manual",
    };
    // Local demo hosts skip pin (already validated). Public HTTPS uses DNS-pinned fetch.
    const usePin =
      !isLocalDemoHost(parsed) &&
      Array.isArray(pinnedAddresses) &&
      pinnedAddresses.length > 0 &&
      pinnedHostname;
    const response = usePin
      ? await pinnedFetch(urlString, fetchInit, {
          addresses: pinnedAddresses,
          hostname: pinnedHostname,
        })
      : await fetch(urlString, fetchInit);

    const raw = await readBoundedResponse(response);
    const cap = Number(maxResponseChars) > 0 ? Number(maxResponseChars) : MAX_RESPONSE_CHARS;
    let truncated = false;
    let bodyText = raw;
    let partial = false;
    const okHttp = response.status >= 200 && response.status < 300;
    const contentType = String(response.headers.get("content-type") || "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    const isJson =
      contentType === "application/json" || contentType.endsWith("+json");
    const isXml = isXmlContentType(contentType);

    // REST_JSON must not silently feed unexpected XML to the model.
    if (okHttp && protocolNorm === "REST_JSON" && isXml && raw.trim()) {
      return {
        ok: false,
        status: "ERROR",
        httpStatus: response.status,
        durationMs: Date.now() - started,
        errorCode: "CONTENT_TYPE_INVALID",
        bodyText: "Upstream returned XML but this action expects JSON (protocol REST_JSON)",
        truncated: false,
        requestHeaders: headers,
        idempotencyKey: key,
        protocol: "rest",
      };
    }

    if (okHttp && protocolNorm === "XML") {
      if (!isXml && raw.trim() && !isJson) {
        return {
          ok: false,
          status: "ERROR",
          httpStatus: response.status,
          durationMs: Date.now() - started,
          errorCode: "CONTENT_TYPE_INVALID",
          bodyText: "Upstream response must be XML for this action",
          truncated: false,
          requestHeaders: headers,
          idempotencyKey: key,
          protocol: "xml",
        };
      }
      const parsedXml = parseXmlSafely(raw);
      if (!parsedXml.ok) {
        return {
          ok: false,
          status: "ERROR",
          httpStatus: response.status,
          durationMs: Date.now() - started,
          errorCode: parsedXml.errorCode || "XML_PARSE_ERROR",
          bodyText: parsedXml.error,
          truncated: false,
          requestHeaders: headers,
          idempotencyKey: key,
          protocol: "xml",
        };
      }
      bodyText = JSON.stringify(parsedXml.value);
    }

    if (okHttp && protocolNorm === "GRAPHQL") {
      const gql = normalizeGraphQLResponse(raw);
      bodyText = gql.bodyText;
      partial = gql.partial;
      if (!gql.ok) {
        return {
          ok: false,
          status: gql.status,
          httpStatus: response.status,
          durationMs: Date.now() - started,
          errorCode: gql.errorCode,
          bodyText: gql.bodyText,
          truncated: false,
          partial: false,
          requestHeaders: headers,
          idempotencyKey: key,
          protocol: "graphql",
        };
      }
      if (gql.status === "NO_RESULT") {
        return withExecutionEnvelope({
          ok: true,
          status: "NO_RESULT",
          httpStatus: response.status,
          durationMs: Date.now() - started,
          errorCode: null,
          bodyText: "",
          truncated: false,
          partial: false,
          requestHeaders: headers,
          idempotencyKey: key,
          protocol: "graphql",
        });
      }
    }

    if (
      okHttp &&
      protocolNorm === "REST_JSON" &&
      (outputSchemaJson || responseProjectionJson)
    ) {
      if (!isJson && raw.trim()) {
        return {
          ok: false,
          status: "ERROR",
          httpStatus: response.status,
          durationMs: Date.now() - started,
          errorCode: "CONTENT_TYPE_INVALID",
          bodyText: "Upstream response must be JSON for this action contract",
          truncated,
          requestHeaders: headers,
          idempotencyKey: key,
        };
      }
    }

    let normalizedStatus = okHttp ? "OK" : "ERROR";
    if (okHttp && protocolNorm === "GRAPHQL" && partial) normalizedStatus = "PARTIAL";
    if (okHttp && !bodyText.trim()) normalizedStatus = "NO_RESULT";
    if (okHttp && responseProjectionJson && normalizedStatus !== "NO_RESULT") {
      const projectionCheck = validateResponseProjection(responseProjectionJson);
      if (!projectionCheck.ok) {
        return {
          ok: false,
          status: "ERROR",
          httpStatus: response.status,
          durationMs: Date.now() - started,
          errorCode: "OUTPUT_PROJECTION_INVALID",
          bodyText: projectionCheck.error,
          truncated,
          requestHeaders: headers,
          idempotencyKey: key,
        };
      }
      const projected = normalizeProjectedResponse(bodyText, responseProjectionJson);
      if (!projected.ok) {
        return {
          ok: false,
          status: "ERROR",
          httpStatus: response.status,
          durationMs: Date.now() - started,
          errorCode: projected.errorCode,
          bodyText: projected.error,
          truncated,
          requestHeaders: headers,
          idempotencyKey: key,
        };
      }
      normalizedStatus =
        projected.status === "NO_RESULT"
          ? "NO_RESULT"
          : partial
            ? "PARTIAL"
            : projected.status;
      bodyText = projected.value === null ? "" : JSON.stringify(projected.value);
    }

    // 200 that means "no such record" ({status:"UNKNOWN", name:null}, {found:false}).
    if (okHttp && normalizedStatus === "OK" && isNotFoundBodyText(bodyText)) {
      normalizedStatus = "NO_RESULT";
    }

    if (okHttp && outputSchemaJson && normalizedStatus !== "NO_RESULT") {
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

    if (normalizedStatus !== "NO_RESULT") {
      bodyText = sanitizeResponseBodyText(bodyText);
    }
    truncated = bodyText.length > cap;
    if (truncated) bodyText = bodyText.slice(0, cap);

    const result = {
      ok: okHttp && (normalizedStatus === "OK" || normalizedStatus === "PARTIAL" || normalizedStatus === "NO_RESULT"),
      status: okHttp ? normalizedStatus : "ERROR",
      httpStatus: response.status,
      durationMs: Date.now() - started,
      errorCode: okHttp ? null : `HTTP_${response.status}`,
      bodyText,
      truncated,
      partial,
      requestHeaders: headers,
      idempotencyKey: key,
      protocol: protocolNorm === "GRAPHQL" ? "graphql" : protocolNorm === "XML" ? "xml" : "rest",
    };
    return withExecutionEnvelope(result);
  } catch (err) {
    const aborted = err?.name === "AbortError";
    const oversized = err?.code === "RESPONSE_TOO_LARGE";
    const ssrf = err?.code === "SSRF_BLOCKED";
    return withExecutionEnvelope({
      ok: false,
      status: aborted ? "TIMEOUT" : ssrf ? "SSRF_BLOCKED" : "ERROR",
      httpStatus: null,
      durationMs: Date.now() - started,
      errorCode: aborted
        ? "TIMEOUT"
        : oversized
          ? "RESPONSE_TOO_LARGE"
          : ssrf
            ? "SSRF_BLOCKED"
            : "FETCH_ERROR",
      bodyText: aborted
        ? `Timed out after ${ms}ms`
        : oversized
          ? "Upstream response exceeded its size limit"
          : ssrf
            ? err.message || "URL blocked"
            : "Request failed",
      truncated: false,
      requestHeaders: headers,
      idempotencyKey: key,
    });
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
