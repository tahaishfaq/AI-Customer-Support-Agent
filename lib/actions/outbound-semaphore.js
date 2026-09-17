/**
 * Concurrent outbound cap per agent (F11 Phase E + R3 Redis).
 * REDIS_ENABLED=1 → shared Redis counter (Lua acquire/release).
 * Otherwise / on Redis error → in-process Map (fail-open local).
 */

import { MAX_CONCURRENT_OUTBOUND } from "./action-config.js";
import { getConnectedRedis, isRedisEnabled } from "../redis/client.js";
import { outboundSemRedisKey } from "../redis/keys.js";

/** @type {Map<string, { active: number, waiters: Array<() => void> }>} */
const gates = new Map();

/** @type {null | object} */
let redisOverride = null;

export function __setOutboundSemRedisForTests(fake) {
  redisOverride = fake;
}

const ACQUIRE_LUA = `
local key = KEYS[1]
local max = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
local n = redis.call('INCR', key)
if n == 1 then
  redis.call('EXPIRE', key, ttl)
end
if n > max then
  redis.call('DECR', key)
  return 0
end
redis.call('EXPIRE', key, ttl)
return 1
`;

const RELEASE_LUA = `
local key = KEYS[1]
local n = redis.call('DECR', key)
if n == false or n <= 0 then
  redis.call('DEL', key)
  return 0
end
return n
`;

async function redisClient() {
  if (redisOverride) return redisOverride;
  if (!isRedisEnabled()) return null;
  return getConnectedRedis();
}

function getGate(agentId) {
  const key = String(agentId || "unknown");
  let gate = gates.get(key);
  if (!gate) {
    gate = { active: 0, waiters: [] };
    gates.set(key, gate);
  }
  return gate;
}

function releaseMemorySlot(agentId) {
  const gate = getGate(agentId);
  gate.active = Math.max(0, gate.active - 1);
  const next = gate.waiters.shift();
  if (next) next();
  if (gate.active === 0 && gate.waiters.length === 0) {
    gates.delete(String(agentId || "unknown"));
  }
}

async function tryRedisAcquire(agentId, limit, ttlSec) {
  const redis = await redisClient();
  if (!redis) return null;
  const key = outboundSemRedisKey(agentId);
  try {
    if (typeof redis.eval === "function") {
      const result = await redis.eval(ACQUIRE_LUA, 1, key, String(limit), String(ttlSec));
      return Number(result) === 1;
    }
    // Fake / minimal client: INCR + compare
    const n = await redis.incr(key);
    if (n === 1 && typeof redis.expire === "function") {
      await redis.expire(key, ttlSec);
    }
    if (n > limit) {
      await redis.decr(key);
      return false;
    }
    if (typeof redis.expire === "function") {
      await redis.expire(key, ttlSec);
    }
    return true;
  } catch {
    return null;
  }
}

async function tryRedisRelease(agentId) {
  const redis = await redisClient();
  if (!redis) return false;
  const key = outboundSemRedisKey(agentId);
  try {
    if (typeof redis.eval === "function") {
      await redis.eval(RELEASE_LUA, 1, key);
      return true;
    }
    const n = await redis.decr(key);
    if (Number(n) <= 0 && typeof redis.del === "function") {
      await redis.del(key);
    }
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Acquire an outbound slot for this agent (max MAX_CONCURRENT_OUTBOUND).
 * @returns {Promise<{ ok: true, release: () => void } | { ok: false, errorCode: string }>}
 */
export async function acquireOutboundSlot(
  agentId,
  {
    max = MAX_CONCURRENT_OUTBOUND,
    waitMs = 8_000,
    leaseTtlSec = 120,
  } = {}
) {
  const limit = Math.max(1, Math.min(Number(max) || MAX_CONCURRENT_OUTBOUND, 8));
  const deadline = Date.now() + Math.max(100, waitMs);
  const ttl = Math.max(30, Math.floor(Number(leaseTtlSec) || 120));

  // Prefer Redis when available.
  let redisMode = null;
  while (Date.now() <= deadline) {
    const acquired = await tryRedisAcquire(agentId, limit, ttl);
    if (acquired === true) {
      return {
        ok: true,
        release: () => {
          void tryRedisRelease(agentId);
        },
      };
    }
    if (acquired === null) {
      redisMode = false;
      break;
    }
    redisMode = true;
    await sleep(50);
  }

  if (redisMode === true) {
    return { ok: false, errorCode: "CONCURRENCY_LIMIT" };
  }

  // Memory fallback (Redis off / error).
  const gate = getGate(agentId);
  if (gate.active < limit) {
    gate.active += 1;
    return {
      ok: true,
      release: () => releaseMemorySlot(agentId),
    };
  }

  const remaining = Math.max(0, deadline - Date.now());
  if (remaining < 50) {
    return { ok: false, errorCode: "CONCURRENCY_LIMIT" };
  }

  const acquired = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      const idx = gate.waiters.indexOf(onReady);
      if (idx >= 0) gate.waiters.splice(idx, 1);
      resolve(false);
    }, remaining);

    function onReady() {
      if (gate.active < limit) {
        clearTimeout(timer);
        gate.active += 1;
        resolve(true);
        return;
      }
      gate.waiters.push(onReady);
    }

    gate.waiters.push(onReady);
  });

  if (!acquired) {
    return { ok: false, errorCode: "CONCURRENCY_LIMIT" };
  }

  return {
    ok: true,
    release: () => releaseMemorySlot(agentId),
  };
}

export function releaseOutboundSlot(agentId) {
  // Memory path (tests / sync callers). Redis releases go through slot.release().
  releaseMemorySlot(agentId);
}

/**
 * Run fn while holding an outbound slot.
 */
export async function withOutboundSlot(agentId, fn, opts) {
  const slot = await acquireOutboundSlot(agentId, opts);
  if (!slot.ok) {
    return {
      ok: false,
      status: "ERROR",
      httpStatus: null,
      durationMs: 0,
      errorCode: slot.errorCode || "CONCURRENCY_LIMIT",
      bodyText: "Too many concurrent action calls for this agent",
      truncated: false,
      retried: false,
    };
  }
  try {
    return await fn();
  } finally {
    slot.release();
  }
}

/** Test helper — reset in-memory gates. */
export function _resetOutboundGatesForTests() {
  gates.clear();
}

/**
 * Prefer GET tools before POST in the same LLM turn (lighter work first).
 * @param {Array<{ function?: { name?: string } }>} toolCalls
 * @param {Map<string, { method?: string }>} byName
 */
export function orderToolCallsGetFirst(toolCalls, byName) {
  if (!Array.isArray(toolCalls) || toolCalls.length < 2) {
    return toolCalls || [];
  }
  return [...toolCalls].sort((a, b) => {
    const ma = String(
      byName.get(a?.function?.name)?.method || "GET"
    ).toUpperCase();
    const mb = String(
      byName.get(b?.function?.name)?.method || "GET"
    ).toUpperCase();
    const ra = ma === "POST" ? 1 : 0;
    const rb = mb === "POST" ? 1 : 0;
    return ra - rb;
  });
}
