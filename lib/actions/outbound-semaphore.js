/**
 * In-process concurrent outbound cap per agent (F11 Phase E).
 * Same MVP limits as rate-limit.js — per serverless instance, not global Redis.
 */

import { MAX_CONCURRENT_OUTBOUND } from "./action-config.js";

/** @type {Map<string, { active: number, waiters: Array<() => void> }>} */
const gates = new Map();

function getGate(agentId) {
  const key = String(agentId || "unknown");
  let gate = gates.get(key);
  if (!gate) {
    gate = { active: 0, waiters: [] };
    gates.set(key, gate);
  }
  return gate;
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
  } = {}
) {
  const gate = getGate(agentId);
  const limit = Math.max(1, Math.min(Number(max) || MAX_CONCURRENT_OUTBOUND, 8));

  if (gate.active < limit) {
    gate.active += 1;
    return {
      ok: true,
      release: () => releaseOutboundSlot(agentId),
    };
  }

  const acquired = await new Promise((resolve) => {
    const timer = setTimeout(() => {
      const idx = gate.waiters.indexOf(onReady);
      if (idx >= 0) gate.waiters.splice(idx, 1);
      resolve(false);
    }, Math.max(100, waitMs));

    function onReady() {
      if (gate.active < limit) {
        clearTimeout(timer);
        gate.active += 1;
        resolve(true);
        return;
      }
      // Slot taken by another waiter — re-queue.
      gate.waiters.push(onReady);
    }

    gate.waiters.push(onReady);
  });

  if (!acquired) {
    return { ok: false, errorCode: "CONCURRENCY_LIMIT" };
  }

  return {
    ok: true,
    release: () => releaseOutboundSlot(agentId),
  };
}

export function releaseOutboundSlot(agentId) {
  const gate = getGate(agentId);
  gate.active = Math.max(0, gate.active - 1);
  const next = gate.waiters.shift();
  if (next) next();
  if (gate.active === 0 && gate.waiters.length === 0) {
    gates.delete(String(agentId || "unknown"));
  }
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
