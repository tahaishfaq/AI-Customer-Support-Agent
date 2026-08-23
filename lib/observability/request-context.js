import { AsyncLocalStorage } from "node:async_hooks";

const storage = new AsyncLocalStorage();

/**
 * Run work with a shared request context (chat → classify → nested awaits).
 * @template T
 * @param {{ requestId?: string, agentId?: string, conversationId?: string, route?: string }} ctx
 * @param {() => T | Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function runWithRequestContext(ctx, fn) {
  return storage.run({ ...(ctx || {}) }, fn);
}

export function getRequestContext() {
  return storage.getStore() || {};
}

/** Merge explicit meta over ALS context (explicit wins). */
export function resolveLogMeta(meta = {}) {
  const ctx = getRequestContext();
  return {
    requestId: meta.requestId ?? ctx.requestId,
    agentId: meta.agentId ?? ctx.agentId,
    conversationId: meta.conversationId ?? ctx.conversationId,
    route: meta.route ?? ctx.route,
    ...meta,
  };
}
