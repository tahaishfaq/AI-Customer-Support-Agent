/**
 * Shared Redis client for app cache / rate limits / BullMQ.
 * Feature flag: REDIS_ENABLED=1. URL: REDIS_URL or REALTIME_REDIS_URL.
 * Fail-open for rate limits when disabled or down (see rate-limit.js).
 */

import Redis from "ioredis";
import { redisKeyPrefix } from "./keys.js";

let client = null;
let initAttempted = false;
let lastError = null;

export function isRedisEnabled() {
  const flag = String(process.env.REDIS_ENABLED || "")
    .trim()
    .toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

export function resolveRedisUrl() {
  return (
    String(process.env.REDIS_URL || "").trim() ||
    String(process.env.REALTIME_REDIS_URL || "").trim() ||
    ""
  );
}

/**
 * @returns {import("ioredis").default | null}
 */
export function getRedisClient() {
  if (!isRedisEnabled()) return null;
  if (client) return client;
  if (initAttempted) return null;
  initAttempted = true;

  const url = resolveRedisUrl();
  if (!url) {
    lastError = "REDIS_URL (or REALTIME_REDIS_URL) missing while REDIS_ENABLED=1";
    return null;
  }

  try {
    const options = {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: true,
      connectTimeout: 3_000,
      retryStrategy(times) {
        // Dead / unresolvable hosts: stop reconnect spam after a few tries.
        if (times > 3) return null;
        return Math.min(times * 200, 1_000);
      },
      enableOfflineQueue: false,
      username: process.env.REDIS_USERNAME || process.env.REALTIME_REDIS_USERNAME || undefined,
      password: process.env.REDIS_PASSWORD || process.env.REALTIME_REDIS_PASSWORD || undefined,
    };
    client = new Redis(url, options);
    client.on("error", (err) => {
      lastError = String(err?.message || err);
      if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|ENETUNREACH/i.test(lastError)) {
        try {
          client.disconnect(false);
        } catch {
          /* best effort */
        }
      }
    });
    return client;
  } catch (err) {
    lastError = String(err?.message || err);
    client = null;
    return null;
  }
}

/**
 * Ensure connected (lazyConnect). Returns null if unavailable.
 */
export async function getConnectedRedis() {
  const redis = getRedisClient();
  if (!redis) return null;
  try {
    if (redis.status === "wait" || redis.status === "close") {
      await redis.connect();
    }
    if (redis.status !== "ready") {
      await redis.ping();
    }
    return redis;
  } catch (err) {
    lastError = String(err?.message || err);
    return null;
  }
}

/**
 * Health probe for /api/health — never throws.
 * @returns {{ status: "ok"|"disabled"|"error"|"misconfigured", prefix: string, error?: string }}
 */
export async function getRedisHealth() {
  const prefix = redisKeyPrefix();
  if (!isRedisEnabled()) {
    return { status: "disabled", prefix };
  }
  if (!resolveRedisUrl()) {
    return { status: "misconfigured", prefix, error: lastError || "missing URL" };
  }
  try {
    const redis = await getConnectedRedis();
    if (!redis) {
      return { status: "error", prefix, error: lastError || "unavailable" };
    }
    const pong = await redis.ping();
    if (String(pong).toUpperCase() !== "PONG") {
      return { status: "error", prefix, error: "unexpected ping" };
    }
    return { status: "ok", prefix };
  } catch (err) {
    return {
      status: "error",
      prefix,
      error: String(err?.message || err || lastError || "error"),
    };
  }
}

/** Test helper — reset singleton between cases. */
export function __resetRedisClientForTests() {
  if (client) {
    try {
      client.disconnect();
    } catch {
      // ignore
    }
  }
  client = null;
  initAttempted = false;
  lastError = null;
}
