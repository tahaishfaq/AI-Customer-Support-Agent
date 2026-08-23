/**
 * Tunable in-memory rate limits (per serverless instance).
 * Override via env without code changes. Shared Redis is a Phase G later decision.
 */

function intEnv(name, fallback, { min = 1, max = 100_000 } = {}) {
  const n = Number(process.env[name]);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

export function handoffLimitOpts() {
  return {
    limit: intEnv("RATE_LIMIT_HANDOFF", 5),
    windowMs: intEnv("RATE_LIMIT_HANDOFF_WINDOW_MS", 5 * 60_000, {
      min: 60_000,
      max: 86_400_000,
    }),
  };
}

/** Public embed chat — burst-friendly default (was 20/min). */
export function pubChatLimitOpts() {
  return {
    limit: intEnv("RATE_LIMIT_PUB_CHAT", 40),
    windowMs: intEnv("RATE_LIMIT_PUB_CHAT_WINDOW_MS", 60_000, {
      min: 1_000,
      max: 3_600_000,
    }),
  };
}

/** Studio / product chat. */
export function studioChatLimitOpts() {
  return {
    limit: intEnv("RATE_LIMIT_STUDIO_CHAT", 60),
    windowMs: intEnv("RATE_LIMIT_STUDIO_CHAT_WINDOW_MS", 60_000, {
      min: 1_000,
      max: 3_600_000,
    }),
  };
}

/** Public ping / origin claim. */
export function pubPingLimitOpts() {
  return {
    limit: intEnv("RATE_LIMIT_PUB_PING", 12),
    windowMs: intEnv("RATE_LIMIT_PUB_PING_WINDOW_MS", 60_000, {
      min: 1_000,
      max: 3_600_000,
    }),
  };
}

/** Register (counts only after validation). */
export function registerLimitOpts() {
  return {
    limit: intEnv("RATE_LIMIT_REGISTER", 8),
    windowMs: intEnv("RATE_LIMIT_REGISTER_WINDOW_MS", 15 * 60_000, {
      min: 60_000,
      max: 86_400_000,
    }),
  };
}
