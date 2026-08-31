/**
 * Short-TTL cache for idempotent GET action results (F11 Phase F).
 * In-memory per instance — optional speedup, not a correctness guarantee.
 */

import { createHash } from "node:crypto";

const DEFAULT_TTL_MS = 30_000;
const MAX_ENTRIES = 2_000;

/** @type {Map<string, { expiresAt: number, result: object }>} */
const cache = new Map();

function cacheTtlMs() {
  const n = Number(process.env.ACTION_GET_CACHE_TTL_MS);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TTL_MS;
  return Math.min(Math.max(Math.trunc(n), 1_000), 300_000);
}

function prune(now) {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  if (cache.size <= MAX_ENTRIES) return;
  const overflow = cache.size - MAX_ENTRIES;
  let i = 0;
  for (const key of cache.keys()) {
    cache.delete(key);
    i += 1;
    if (i >= overflow) break;
  }
}

/**
 * Stable hash of action id + args for GET cache keys.
 */
export function buildGetCacheKey(actionId, args = {}) {
  const normalized = stableStringify(args);
  const digest = createHash("sha256")
    .update(String(actionId || ""))
    .update("\0")
    .update(normalized)
    .digest("hex")
    .slice(0, 32);
  return `get:${digest}`;
}

function stableStringify(value) {
  if (value == null) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
    .join(",")}}`;
}

/**
 * @returns {object|null} cached executeHttpAction-shaped result
 */
export function getCachedGetResult(actionId, args) {
  const key = buildGetCacheKey(actionId, args);
  const now = Date.now();
  prune(now);
  const entry = cache.get(key);
  if (!entry || entry.expiresAt <= now) {
    if (entry) cache.delete(key);
    return null;
  }
  return {
    ...entry.result,
    cached: true,
    durationMs: 0,
  };
}

/**
 * Store a successful GET result.
 */
export function setCachedGetResult(actionId, args, result) {
  if (!result?.ok) return;
  const key = buildGetCacheKey(actionId, args);
  const now = Date.now();
  prune(now);
  cache.set(key, {
    expiresAt: now + cacheTtlMs(),
    result: {
      ok: true,
      status: result.status || "OK",
      httpStatus: result.httpStatus ?? 200,
      durationMs: result.durationMs ?? 0,
      errorCode: null,
      bodyText: result.bodyText,
      truncated: Boolean(result.truncated),
      retried: false,
      demo: Boolean(result.demo),
    },
  });
}

export function isGetMethod(method) {
  return String(method || "GET").toUpperCase() !== "POST";
}

/** Test helper */
export function _resetGetCacheForTests() {
  cache.clear();
}

export function _getCacheSizeForTests() {
  return cache.size;
}
