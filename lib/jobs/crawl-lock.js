/**
 * Per-agent crawl lock (R6) — at most one crawl runner per agent.
 * Redis SET NX when REDIS_ENABLED; fail-open (allow) when Redis off.
 */

import { randomBytes } from "node:crypto";
import { getConnectedRedis, isRedisEnabled } from "../redis/client.js";
import { crawlLockRedisKey } from "../redis/keys.js";

/** @type {null | object} */
let redisOverride = null;

const RELEASE_LUA = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`;

export function __setCrawlLockRedisForTests(fake) {
  redisOverride = fake;
}

async function redisClient() {
  if (redisOverride) return redisOverride;
  if (!isRedisEnabled()) return null;
  return getConnectedRedis();
}

/**
 * @returns {Promise<{ ok: true, token: string|null, backend: string } | { ok: false, backend: string }>}
 */
export async function acquireCrawlLock(agentId, { ttlSec = 900 } = {}) {
  const id = String(agentId || "").trim();
  if (!id) return { ok: false, backend: "invalid" };

  const redis = await redisClient();
  if (!redis) {
    return { ok: true, token: null, backend: "none" };
  }

  const key = crawlLockRedisKey(id);
  const token = randomBytes(8).toString("hex");
  const ttl = Math.max(60, Math.floor(Number(ttlSec) || 900));

  try {
    const result = await redis.set(key, token, "EX", ttl, "NX");
    if (result === "OK") {
      return { ok: true, token, backend: "redis" };
    }
    return { ok: false, backend: "redis" };
  } catch {
    return { ok: true, token: null, backend: "error-open" };
  }
}

export async function releaseCrawlLock(agentId, token) {
  if (!token) return;
  const id = String(agentId || "").trim();
  if (!id) return;
  const redis = await redisClient();
  if (!redis) return;
  const key = crawlLockRedisKey(id);
  try {
    if (typeof redis.eval === "function") {
      await redis.eval(RELEASE_LUA, 1, key, token);
      return;
    }
    const current = await redis.get(key);
    if (current === token) await redis.del(key);
  } catch {
    // ignore
  }
}
