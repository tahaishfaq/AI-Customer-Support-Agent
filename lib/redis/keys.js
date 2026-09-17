/**
 * Redis key helpers — aide:{env}:{domain}:…
 * Never store OTP plaintext, passwords, or ACTION secrets in Redis.
 */

export function redisEnvName() {
  const raw = String(process.env.REDIS_KEY_ENV || process.env.NODE_ENV || "development")
    .trim()
    .toLowerCase();
  if (raw === "production" || raw === "prod") return "prod";
  if (raw === "test") return "test";
  return "dev";
}

export function redisKeyPrefix() {
  const custom = String(process.env.REDIS_KEY_PREFIX || "").trim();
  if (custom) return custom.endsWith(":") ? custom : `${custom}:`;
  return `aide:${redisEnvName()}:`;
}

export function redisKey(...parts) {
  const prefix = redisKeyPrefix();
  const body = parts
    .map((p) => String(p ?? "").trim())
    .filter(Boolean)
    .join(":");
  return `${prefix}${body}`;
}

export function rateLimitRedisKey(bucket) {
  return redisKey("rl", bucket);
}

/** Password-reset OTP HASH — fields: tokenId, tokenHash, attempts, expiresAt (ms). Hash only. */
export function otpResetRedisKey(userId) {
  return redisKey("otp", "reset", userId);
}

/** Resend cooldown — value "1", TTL = cooldown seconds. */
export function otpCooldownRedisKey(userId) {
  return redisKey("otp", "cooldown", userId);
}

/** Public user profile JSON cache (no password/secrets). */
export function profileRedisKey(userId) {
  return redisKey("profile", userId);
}

/** Per-agent outbound concurrency counter (semaphore). */
export function outboundSemRedisKey(agentId) {
  return redisKey("sem", "outbound", agentId);
}

/** Shared GET action result cache — digest is sha256 slice of actionId+args. */
export function actionGetCacheRedisKey(digest) {
  return redisKey("action", "get", digest);
}

/** Per-agent crawl lock — SET NX EX while a crawl runs. */
export function crawlLockRedisKey(agentId) {
  return redisKey("lock", "crawl", agentId);
}
