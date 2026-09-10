const MAX_PROJECTION_FIELDS = 50;
const PATH_RE = /^[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)*$/;
const PROHIBITED_KEY_RE = /^(?:authorization|password|passwd|secret|token|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key|client[_-]?secret|cvv|card[_-]?number|email|phone|mobile|address|street|full[_-]?name)$/i;

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function getPath(value, path) {
  return String(path)
    .split(".")
    .reduce((current, key) => (current == null ? undefined : current[key]), value);
}

function setPath(target, path, value) {
  const parts = String(path).split(".");
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    cursor[parts[index]] ||= {};
    cursor = cursor[parts[index]];
  }
  cursor[parts.at(-1)] = value;
}

function pathContainsProhibitedKey(path) {
  return String(path).split(".").some((part) => PROHIBITED_KEY_RE.test(part));
}

export function sanitizeResponseValue(value) {
  if (Array.isArray(value)) return value.map(sanitizeResponseValue);
  if (!isObject(value)) return value;
  const output = {};
  for (const [key, nested] of Object.entries(value)) {
    output[key] = PROHIBITED_KEY_RE.test(key)
      ? "[redacted]"
      : sanitizeResponseValue(nested);
  }
  return output;
}

export function sanitizeResponseBodyText(bodyText) {
  const text = String(bodyText || "");
  try {
    return JSON.stringify(sanitizeResponseValue(JSON.parse(text)));
  } catch {
    return text
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
      .replace(/\b(?:\+?\d[\d .()-]{7,}\d)\b/g, "[redacted-phone]");
  }
}

export function validateResponseProjection(projection) {
  if (projection == null) return { ok: true, projection: null };
  if (!isObject(projection)) {
    return { ok: false, error: "Response projection must be an object" };
  }
  const fields = projection.fields;
  if (!Array.isArray(fields) || fields.length < 1 || fields.length > MAX_PROJECTION_FIELDS) {
    return { ok: false, error: `Response projection fields must contain 1-${MAX_PROJECTION_FIELDS} paths` };
  }
  const normalized = [...new Set(fields.map((field) => String(field).trim()))];
  if (normalized.some((field) => !PATH_RE.test(field))) {
    return { ok: false, error: "Response projection contains an invalid field path" };
  }
  if (normalized.some(pathContainsProhibitedKey)) {
    return { ok: false, error: "Response projection cannot select secret or credential fields" };
  }
  return { ok: true, projection: { fields: normalized } };
}

export function projectResponseValue(value, projection) {
  const checked = validateResponseProjection(projection);
  if (!checked.ok) return checked;
  if (!checked.projection) return { ok: true, value, projected: false };
  if (!isObject(value)) {
    return { ok: false, error: "Response must be a JSON object for projection" };
  }

  const output = {};
  for (const path of checked.projection.fields) {
    const selected = getPath(value, path);
    if (selected !== undefined) setPath(output, path, selected);
  }
  return { ok: true, value: sanitizeResponseValue(output), projected: true };
}

export function normalizeProjectedResponse(bodyText, projection = null) {
  if (!String(bodyText || "").trim()) {
    return { ok: true, status: "NO_RESULT", value: null };
  }
  let parsed;
  try {
    parsed = JSON.parse(String(bodyText || ""));
  } catch {
    return { ok: false, errorCode: "CONTENT_TYPE_INVALID", error: "Response must be JSON" };
  }
  if (parsed === null || (Array.isArray(parsed) && parsed.length === 0)) {
    return { ok: true, status: "NO_RESULT", value: null };
  }
  const projected = projectResponseValue(parsed, projection);
  if (!projected.ok) {
    return { ok: false, errorCode: "OUTPUT_PROJECTION_INVALID", error: projected.error };
  }
  if (isObject(projected.value) && Object.keys(projected.value).length === 0) {
    return { ok: true, status: "NO_RESULT", value: null };
  }
  return { ok: true, status: "OK", value: sanitizeResponseValue(projected.value) };
}

export { MAX_PROJECTION_FIELDS, PROHIBITED_KEY_RE };
