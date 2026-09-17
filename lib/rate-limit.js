import { NextResponse } from "next/server";
import {
  resolveRequestId,
  requestIdHeaders,
} from "@/lib/observability/request-id";
import { getConnectedRedis, isRedisEnabled } from "@/lib/redis/client";
import { rateLimitRedisKey } from "@/lib/redis/keys";

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
 * Used when Redis is off or unavailable (fail-open for public chat paths).
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
 * @returns {{ ok: true } | { ok: false, retryAfterSec: number }}
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
 * Fixed-window limiter. Prefers Redis when REDIS_ENABLED=1; falls back to memory.
 * Callers must await (route handlers are async).
 * @returns {Promise<{ ok: true, backend?: string } | { ok: false, retryAfterSec: number, backend?: string }>}
 */
export async function rateLimit(key, { limit, windowMs }) {
  if (isRedisEnabled()) {
    try {
      const remote = await rateLimitRedis(key, { limit, windowMs });
      if (remote) return remote;
    } catch {
      // fall through to memory
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

export function tooManyRequests(
  limited,
  message = "Too many requests. Try again shortly.",
  request = null
) {
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
