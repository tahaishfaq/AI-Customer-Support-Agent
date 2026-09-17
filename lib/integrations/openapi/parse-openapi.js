/**
 * OpenAPI 3.x → AgentAction draft templates (pure).
 * Does not create DB rows; does not invent credentials or publish.
 */
import {
  isAllowedActionHttpMethod,
  isValidActionName,
  normalizeActionName,
} from "../../actions/action-config.js";

export const OPENAPI_IMPORT_MAX_OPS = 50;

const SUPPORTED_OPENAPI_MAJOR = 3;

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

/**
 * Accept object or JSON string. YAML is not supported (no dependency).
 * @param {unknown} raw
 */
export function parseOpenApiDocument(raw) {
  let doc = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) throw httpError(400, "OpenAPI document is empty");
    try {
      doc = JSON.parse(trimmed);
    } catch {
      throw httpError(400, "OpenAPI document must be valid JSON (YAML not supported)");
    }
  }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    throw httpError(400, "OpenAPI document must be a JSON object");
  }
  const version = String(doc.openapi || doc.swagger || "");
  const major = Number.parseInt(version.split(".")[0], 10);
  if (doc.swagger && !doc.openapi) {
    throw httpError(400, "Swagger 2.0 is not supported; use OpenAPI 3.x", {
      code: "OPENAPI_VERSION_UNSUPPORTED",
    });
  }
  if (!Number.isFinite(major) || major !== SUPPORTED_OPENAPI_MAJOR) {
    throw httpError(400, "openapi field must be 3.x", {
      code: "OPENAPI_VERSION_UNSUPPORTED",
      openapi: version || null,
    });
  }
  if (!doc.paths || typeof doc.paths !== "object") {
    throw httpError(400, "OpenAPI document requires a paths object");
  }
  return doc;
}

function joinBaseAndPath(baseUrl, path) {
  const base = String(baseUrl || "").replace(/\/$/, "");
  const p = String(path || "");
  if (!base) return p;
  if (/^https?:\/\//i.test(p)) return p;
  return `${base}${p.startsWith("/") ? p : `/${p}`}`;
}

/**
 * OpenAPI `{id}` → Aide `{{id}}` path/query templates.
 */
export function openApiPathToUrlTemplate(path) {
  return String(path || "").replace(/\{([a-zA-Z0-9_]+)\}/g, "{{$1}}");
}

function resolveServerBase(doc, baseUrlOverride) {
  if (baseUrlOverride) {
    return String(baseUrlOverride).trim().replace(/\/$/, "");
  }
  const servers = Array.isArray(doc.servers) ? doc.servers : [];
  const first = servers.find((s) => s && typeof s.url === "string" && s.url.trim());
  if (!first) return "";
  return String(first.url).trim().replace(/\/$/, "");
}

function isAllowedUrlTemplate(url) {
  return (
    /^https:\/\//i.test(url) ||
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(url)
  );
}

function toSnakeCase(raw) {
  return String(raw || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9_]+/g, "_");
}

function sanitizeNameCandidate(raw) {
  let name = normalizeActionName(toSnakeCase(raw))
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!name) return "";
  if (/^[0-9]/.test(name)) name = `op_${name}`;
  if (name.length > 64) name = name.slice(0, 64).replace(/_+$/g, "");
  return isValidActionName(name) ? name : "";
}

/** Keep OpenAPI param identifiers so {{orderId}} matches inputSchema keys. */
function argName(raw) {
  const name = String(raw || "").trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return "";
  return name;
}

function nameFromPath(method, path) {
  const bits = String(path || "")
    .split("/")
    .filter(Boolean)
    .map((seg) => seg.replace(/^\{|\}$/g, ""));
  return sanitizeNameCandidate([method.toLowerCase(), ...bits].join("_"));
}

function uniqueName(preferred, used) {
  let base = preferred || "imported_op";
  if (!isValidActionName(base)) base = "imported_op";
  let name = base;
  let n = 2;
  while (used.has(name)) {
    const suffix = `_${n}`;
    name = `${base.slice(0, Math.max(1, 64 - suffix.length))}${suffix}`;
    n += 1;
  }
  used.add(name);
  return name;
}

function schemaType(schema) {
  if (!schema || typeof schema !== "object") return "string";
  const t = schema.type;
  if (typeof t === "string") return t;
  if (Array.isArray(t) && t.length) return String(t[0]);
  if (schema.properties) return "object";
  if (schema.items) return "array";
  return "string";
}

function collectParameters(pathItem, operation) {
  const list = [];
  for (const src of [pathItem?.parameters, operation?.parameters]) {
    if (!Array.isArray(src)) continue;
    for (const p of src) {
      if (p && typeof p === "object") list.push(p);
    }
  }
  return list;
}

function buildInputSchema(parameters, operation) {
  const properties = {};
  const required = [];
  for (const param of parameters) {
    const name = argName(param.name);
    if (!name) continue;
    const schema = param.schema || { type: "string" };
    properties[name] = { type: schemaType(schema) };
    if (param.required) required.push(name);
  }

  const body =
    operation?.requestBody?.content?.["application/json"]?.schema ||
    operation?.requestBody?.content?.["application/x-www-form-urlencoded"]?.schema;
  if (body?.properties && typeof body.properties === "object") {
    for (const [key, schema] of Object.entries(body.properties)) {
      const name = argName(key) || sanitizeNameCandidate(key);
      if (!name) continue;
      properties[name] = { type: schemaType(schema) };
    }
    if (Array.isArray(body.required)) {
      for (const key of body.required) {
        const name = argName(key) || sanitizeNameCandidate(key);
        if (name && properties[name] && !required.includes(name)) {
          required.push(name);
        }
      }
    }
  }

  if (!Object.keys(properties).length) return null;
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

function appendQueryTemplate(url, parameters) {
  const queryParams = parameters.filter(
    (p) => String(p.in || "").toLowerCase() === "query" && p.name
  );
  if (!queryParams.length) return url;
  const parts = queryParams.map((p) => {
    const key = encodeURIComponent(String(p.name));
    const arg = argName(p.name) || sanitizeNameCandidate(p.name);
    return `${key}={{${arg}}}`;
  });
  const join = url.includes("?") ? "&" : "?";
  return `${url}${join}${parts.join("&")}`;
}

/**
 * Conservative defaults — imports are disabled until policy review + enable/publish.
 */
export function draftPolicyForMethod(method) {
  const m = String(method || "").toUpperCase();
  if (m === "POST") {
    return {
      accessClass: "ACCOUNT_WRITE",
      riskLevel: "WRITE",
      requiresConfirmation: true,
      requiresIdentity: true,
      identityMode: "END_USER_TOKEN",
      idempotent: false,
    };
  }
  return {
    accessClass: "ACCOUNT_READ",
    riskLevel: "READ",
    requiresConfirmation: true,
    requiresIdentity: true,
    identityMode: "END_USER_TOKEN",
    idempotent: true,
  };
}

/**
 * @param {object} doc — parsed OpenAPI 3 document
 * @param {{ baseUrl?: string, existingNames?: string[], maxOps?: number }} [opts]
 * @returns {{
 *   drafts: Array<object>,
 *   skipped: Array<{ path: string, method: string, reason: string }>,
 *   meta: { title: string|null, openapi: string, needsPublish: true, needsPolicyReview: true }
 * }}
 */
export function buildOpenApiActionDrafts(doc, opts = {}) {
  const base = resolveServerBase(doc, opts.baseUrl);
  if (!base || !/^https?:\/\//i.test(base)) {
    throw httpError(
      400,
      "A absolute base URL is required (servers[0].url or baseUrl option)",
      { code: "OPENAPI_BASE_URL_REQUIRED" }
    );
  }

  const maxOps = Math.min(
    Number(opts.maxOps) > 0 ? Number(opts.maxOps) : OPENAPI_IMPORT_MAX_OPS,
    OPENAPI_IMPORT_MAX_OPS
  );
  const used = new Set(
    (opts.existingNames || []).map((n) => normalizeActionName(n)).filter(Boolean)
  );
  const drafts = [];
  const skipped = [];

  const paths = doc.paths || {};
  for (const [rawPath, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;
    for (const [methodRaw, operation] of Object.entries(pathItem)) {
      const method = String(methodRaw || "").toUpperCase();
      if (
        ["PARAMETERS", "SUMMARY", "DESCRIPTION", "SERVERS", "$REF"].includes(method)
      ) {
        continue;
      }
      if (!operation || typeof operation !== "object") continue;

      if (!isAllowedActionHttpMethod(method)) {
        skipped.push({
          path: rawPath,
          method,
          reason: "METHOD_UNSUPPORTED",
        });
        continue;
      }
      if (operation.deprecated === true) {
        skipped.push({ path: rawPath, method, reason: "DEPRECATED" });
        continue;
      }
      if (drafts.length >= maxOps) {
        skipped.push({ path: rawPath, method, reason: "MAX_OPS" });
        continue;
      }

      let urlTemplate = openApiPathToUrlTemplate(joinBaseAndPath(base, rawPath));
      const parameters = collectParameters(pathItem, operation);
      urlTemplate = appendQueryTemplate(urlTemplate, parameters);

      if (!isAllowedUrlTemplate(urlTemplate) || /\s/.test(urlTemplate)) {
        skipped.push({ path: rawPath, method, reason: "URL_INVALID" });
        continue;
      }

      const preferred =
        sanitizeNameCandidate(operation.operationId) ||
        nameFromPath(method, rawPath) ||
        "imported_op";
      const name = uniqueName(preferred, used);
      const description = String(
        operation.summary ||
          operation.description ||
          `${method} ${rawPath}`
      )
        .trim()
        .slice(0, 500);
      const policy = draftPolicyForMethod(method);
      const inputSchemaJson = buildInputSchema(parameters, operation);

      drafts.push({
        name,
        description: description || `${method} ${rawPath}`,
        method,
        urlTemplate,
        inputSchemaJson: inputSchemaJson || undefined,
        enabled: false,
        timeoutMs: 8000,
        ...policy,
        needsPublish: true,
        needsPolicyReview: true,
        openApi: {
          path: rawPath,
          method,
          operationId: operation.operationId || null,
        },
      });
    }
  }

  return {
    drafts,
    skipped,
    meta: {
      title: doc.info?.title ? String(doc.info.title) : null,
      openapi: String(doc.openapi || ""),
      needsPublish: true,
      needsPolicyReview: true,
      draftCount: drafts.length,
      skippedCount: skipped.length,
    },
  };
}

/**
 * Parse + build drafts in one call.
 */
export function planOpenApiImport(rawDocument, opts = {}) {
  const doc = parseOpenApiDocument(rawDocument);
  return buildOpenApiActionDrafts(doc, opts);
}
