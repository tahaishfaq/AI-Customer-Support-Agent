/**
 * Short-TTL cache for idempotent GET action results (F11 Phase F + R4 Redis).
 * REDIS_ENABLED=1 → shared Redis; otherwise / on error → in-memory Map.
 * Never cache WRITE results or secrets. Body size capped.
 */

import { createHash } from "node:crypto";
import { getConnectedRedis, isRedisEnabled } from "../redis/client.js";
import { actionGetCacheRedisKey } from "../redis/keys.js";

const DEFAULT_TTL_MS = 30_000;
const MAX_ENTRIES = 2_000;
const MAX_BODY_CHARS = 32_000;

/** @type {Map<string, { expiresAt: number, result: object }>} */
const cache = new Map();

/** @type {null | { get: Function, set: Function, del?: Function }} */
let redisOverride = null;

export function __setGetCacheRedisForTests(fake) {
  redisOverride = fake;
}

function cacheTtlMs() {
  const n = Number(process.env.ACTION_GET_CACHE_TTL_MS);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TTL_MS;
  return Math.min(Math.max(Math.trunc(n), 1_000), 300_000);
}

function cacheTtlSec() {
  return Math.max(1, Math.ceil(cacheTtlMs() / 1000));
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

function digestFromCacheKey(key) {
  return String(key || "").replace(/^get:/, "");
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

function shapeResult(result) {
  return {
    ok: true,
    status: result.status || "OK",
    httpStatus: result.httpStatus ?? 200,
    durationMs: result.durationMs ?? 0,
    errorCode: null,
    bodyText: result.bodyText,
    truncated: Boolean(result.truncated),
    retried: false,
    demo: Boolean(result.demo),
  };
}

function hitPayload(stored) {
  return {
    ...stored,
    cached: true,
    durationMs: 0,
  };
}

async function redisClient() {
  if (redisOverride) return redisOverride;
  if (!isRedisEnabled()) return null;
  return getConnectedRedis();
}

function memoryGet(key) {
  const now = Date.now();
  prune(now);
  const entry = cache.get(key);
  if (!entry || entry.expiresAt <= now) {
    if (entry) cache.delete(key);
    return null;
  }
  return hitPayload(entry.result);
}

function memorySet(key, result) {
  const now = Date.now();
  prune(now);
  cache.set(key, {
    expiresAt: now + cacheTtlMs(),
    result: shapeResult(result),
  });
}

/**
 * @returns {Promise<object|null>} cached executeHttpAction-shaped result
 */
export async function getCachedGetResult(actionId, args) {
  const key = buildGetCacheKey(actionId, args);
  const redis = await redisClient();
  if (redis) {
    try {
      const raw = await redis.get(
        actionGetCacheRedisKey(digestFromCacheKey(key))
      );
      if (raw) {
        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (parsed?.ok) return hitPayload(parsed);
      }
    } catch {
      // fall through to memory
    }
  }
  return memoryGet(key);
}

/**
 * Store a successful GET result. Skips errors, oversized bodies, WRITE callers.
 */
export async function setCachedGetResult(actionId, args, result) {
  if (!result?.ok) return;
  const body = result.bodyText == null ? "" : String(result.bodyText);
  if (body.length > MAX_BODY_CHARS) return;

  const key = buildGetCacheKey(actionId, args);
  const stored = shapeResult({ ...result, bodyText: body });
  memorySet(key, stored);

  const redis = await redisClient();
  if (!redis) return;
  try {
    await redis.set(
      actionGetCacheRedisKey(digestFromCacheKey(key)),
      JSON.stringify(stored),
      "EX",
      cacheTtlSec()
    );
  } catch {
    // memory already filled
  }
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

export const GET_CACHE_MAX_BODY_CHARS = MAX_BODY_CHARS;
