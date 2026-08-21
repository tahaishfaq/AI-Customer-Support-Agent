import { NextResponse } from "next/server";

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
 * Read-only check — does not increment the counter.
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

/**
 * In-memory fixed-window limiter (per serverless instance).
 * Good enough for Vercel MVP; counts do not sync across instances.
 * @returns {{ ok: true } | { ok: false, retryAfterSec: number }}
 */
export function rateLimit(key, { limit, windowMs }) {
  const now = Date.now();
  prune(now);

  const existing = buckets.get(key);
  if (!existing || now - existing.start >= windowMs) {
    buckets.set(key, { start: now, count: 1, windowMs });
    return { ok: true };
  }

  if (existing.count >= limit) {
    return { ok: false, retryAfterSec: retryAfterSec(existing, now) };
  }

  existing.count += 1;
  return { ok: true };
}

export function clientIp(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

export function tooManyRequests(
  limited,
  message = "Too many requests. Try again shortly."
) {
  return NextResponse.json(
    { error: { message, details: {} } },
    {
      status: 429,
      headers: { "Retry-After": String(limited.retryAfterSec) },
    }
  );
}
