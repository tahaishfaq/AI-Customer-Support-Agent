/**
 * Safe XML response adapter (AIDE-GAP-004).
 * Only used when action protocol is XML. XXE/DTD/entity expansion blocked.
 */

import { XMLParser } from "fast-xml-parser";

const DOCTYPE_RE = /<!DOCTYPE/i;
const ENTITY_RE = /<!ENTITY/i;
const MAX_XML_CHARS = 100_000;
const MAX_DEPTH = 32;

/**
 * @param {string} contentType
 */
export function isXmlContentType(contentType) {
  const ct = String(contentType || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  return (
    ct === "application/xml" ||
    ct === "text/xml" ||
    ct.endsWith("+xml")
  );
}

/**
 * @param {string} raw
 * @returns {{ ok: true, value: object } | { ok: false, error: string, errorCode: string }}
 */
export function parseXmlSafely(raw) {
  const text = String(raw || "");
  if (!text.trim()) {
    return { ok: true, value: {} };
  }
  if (text.length > MAX_XML_CHARS) {
    return {
      ok: false,
      error: "XML response exceeds size limit",
      errorCode: "RESPONSE_TOO_LARGE",
    };
  }
  if (DOCTYPE_RE.test(text) || ENTITY_RE.test(text)) {
    return {
      ok: false,
      error: "XML DTD / external entities are not allowed",
      errorCode: "XML_UNSAFE",
    };
  }

  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      processEntities: false,
      htmlEntities: false,
      allowBooleanAttributes: false,
      // Reject DOCTYPE if somehow present
      stopNodes: ["*.#text"],
      isArray: () => false,
    });
    const value = parser.parse(text);
    if (!isDepthOk(value, 0)) {
      return {
        ok: false,
        error: "XML nesting exceeds depth limit",
        errorCode: "XML_TOO_DEEP",
      };
    }
    return { ok: true, value: value && typeof value === "object" ? value : { value } };
  } catch (err) {
    return {
      ok: false,
      error: `XML parse failed: ${String(err?.message || err).slice(0, 200)}`,
      errorCode: "XML_PARSE_ERROR",
    };
  }
}

function isDepthOk(node, depth) {
  if (depth > MAX_DEPTH) return false;
  if (!node || typeof node !== "object") return true;
  if (Array.isArray(node)) {
    return node.every((item) => isDepthOk(item, depth + 1));
  }
  return Object.values(node).every((item) => isDepthOk(item, depth + 1));
}
