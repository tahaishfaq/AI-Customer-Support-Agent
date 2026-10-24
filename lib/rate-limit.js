/**
 * Fixed-window rate limiting.
 * Prefers Redis when REDIS_ENABLED=1.
 *
 * AIDE-GAP-007: when Redis is enabled, security-critical paths fail closed
 * (no silent memory fallback). Dev with Redis off still uses in-memory.
 */

import {
  resolveRequestId,
  requestIdHeaders,
} from "./observability/request-id.js";
import { getConnectedRedis, isRedisEnabled } from "./redis/client.js";
import { rateLimitRedisKey } from "./redis/keys.js";

const buckets = new Map();
const MAX_KEYS = 20_000;

function prune(now) {
  if (buckets.size < MAX_KEYS) return;
  for (const [key, entry] of buckets) {
    if (now - entry.start > entry.windowMs) buckets.delete(key);
  }
}

function retryAfterSec(entry, now) {
  return Math.max(
    1,
    Math.ceil((entry.windowMs - (now - entry.start)) / 1000)
  );
}

/**
 * In-memory fixed-window limiter (per process).
 * @returns {{ ok: true, backend: "memory" } | { ok: false, retryAfterSec: number, backend: "memory" }}
 */
export function rateLimitMemory(key, { limit, windowMs }) {
  const now = Date.now();
  prune(now);

  const existing = buckets.get(key);
  if (!existing || now - existing.start >= windowMs) {
    buckets.set(key, { start: now, count: 1, windowMs });
    return { ok: true, backend: "memory" };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      retryAfterSec: retryAfterSec(existing, now),
      backend: "memory",
    };
  }

  existing.count += 1;
  return { ok: true, backend: "memory" };
}

/**
 * Read-only check — does not increment the counter (memory only).
 */
export function isRateLimited(key, { limit, windowMs }) {
  const now = Date.now();
  prune(now);
  const existing = buckets.get(key);
  if (!existing || now - existing.start >= windowMs) {
    return { ok: true };
  }
  if (existing.count >= limit) {
    return { ok: false, retryAfterSec: retryAfterSec(existing, now) };
  }
  return { ok: true };
}

async function rateLimitRedis(key, { limit, windowMs }) {
  const redis = await getConnectedRedis();
  if (!redis) return null;

  const redisKey = rateLimitRedisKey(key);
  const count = await redis.incr(redisKey);
  if (count === 1) {
    await redis.pexpire(redisKey, Math.max(1, Math.floor(windowMs)));
  }
  if (count > limit) {
    const ttl = await redis.pttl(redisKey);
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((ttl > 0 ? ttl : windowMs) / 1000)),
      backend: "redis",
    };
  }
  return { ok: true, backend: "redis" };
}

/**
 * @param {string} key
 * @param {{ limit: number, windowMs: number, failClosed?: boolean }} opts
 * failClosed: when Redis is enabled but unavailable, deny (default true if Redis enabled).
 */
export async function rateLimit(key, { limit, windowMs, failClosed } = {}) {
  const redisOn = isRedisEnabled();
  const closed = failClosed !== undefined ? Boolean(failClosed) : redisOn;

  if (redisOn) {
    try {
      const remote = await rateLimitRedis(key, { limit, windowMs });
      if (remote) return remote;
      if (closed) {
        return {
          ok: false,
          retryAfterSec: Math.max(1, Math.ceil(windowMs / 1000)),
          backend: "redis-unavailable",
          failClosed: true,
        };
      }
    } catch {
      if (closed) {
        return {
          ok: false,
          retryAfterSec: Math.max(1, Math.ceil(windowMs / 1000)),
          backend: "redis-unavailable",
          failClosed: true,
        };
      }
    }
  }
  return rateLimitMemory(key, { limit, windowMs });
}

/** @deprecated use rateLimit (async) — sync alias for memory-only scripts */
export function rateLimitSync(key, opts) {
  return rateLimitMemory(key, opts);
}

export function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

export async function tooManyRequests(
  limited,
  message = "Too many requests. Try again shortly.",
  request = null
) {
  const { NextResponse } = await import("next/server");
  const headers = {
    "Retry-After": String(limited.retryAfterSec),
  };
  if (request) {
    Object.assign(headers, requestIdHeaders(resolveRequestId(request)));
  }
  return NextResponse.json(
    { error: { message, details: {} } },
    {
      status: 429,
      headers,
    }
  );
}

/** Test helper */
export function __resetRateLimitMemoryForTests() {
  buckets.clear();
}
