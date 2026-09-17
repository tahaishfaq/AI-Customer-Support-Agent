/**
 * Redis side-channel for password-reset OTP (R1).
 * Hash-only · Postgres EmailToken remains audit + fallback.
 * Never stores raw OTP. Not PEP / identity authority.
 */

import { getConnectedRedis, isRedisEnabled } from "../redis/client.js";
import { otpCooldownRedisKey, otpResetRedisKey } from "../redis/keys.js";
import { resetOtpResendCooldownSec } from "./constants.js";

/** @type {{ hit: number, miss: number, lock: number, write: number, writeFail: number }} */
export const otpMetrics = {
  hit: 0,
  miss: 0,
  lock: 0,
  write: 0,
  writeFail: 0,
};

/** @type {null | { hset: Function, expire: Function, hgetall: Function, hincrby: Function, del: Function, set: Function, exists: Function }} */
let redisOverride = null;

export function __setOtpRedisForTests(fake) {
  redisOverride = fake;
}

export function __resetOtpMetricsForTests() {
  otpMetrics.hit = 0;
  otpMetrics.miss = 0;
  otpMetrics.lock = 0;
  otpMetrics.write = 0;
  otpMetrics.writeFail = 0;
}

async function redisClient() {
  if (redisOverride) return redisOverride;
  if (!isRedisEnabled()) return null;
  return getConnectedRedis();
}

/**
 * Dual-write after Postgres EmailToken create.
 * Best-effort: failure does not block the Postgres path.
 */
export async function writeResetOtpToRedis({
  userId,
  tokenId,
  tokenHash,
  expiresAtMs,
  ttlSec,
}) {
  const redis = await redisClient();
  if (!redis) return false;
  const key = otpResetRedisKey(userId);
  const ttl = Math.max(1, Math.floor(Number(ttlSec) || 1));
  try {
    await redis.del(key);
    await redis.hset(key, {
      tokenId: String(tokenId),
      tokenHash: String(tokenHash),
      attempts: "0",
      expiresAt: String(Math.floor(expiresAtMs)),
    });
    await redis.expire(key, ttl);
    const coolSec = resetOtpResendCooldownSec();
    if (coolSec > 0) {
      await redis.set(otpCooldownRedisKey(userId), "1", "EX", coolSec);
    }
    otpMetrics.write += 1;
    return true;
  } catch {
    otpMetrics.writeFail += 1;
    return false;
  }
}

/**
 * @returns {Promise<null | { tokenId: string, tokenHash: string, attempts: number, expiresAtMs: number }>}
 */
export async function readResetOtpFromRedis(userId) {
  const redis = await redisClient();
  if (!redis) {
    otpMetrics.miss += 1;
    return null;
  }
  try {
    const raw = await redis.hgetall(otpResetRedisKey(userId));
    if (!raw || !raw.tokenHash) {
      otpMetrics.miss += 1;
      return null;
    }
    otpMetrics.hit += 1;
    return {
      tokenId: String(raw.tokenId || ""),
      tokenHash: String(raw.tokenHash),
      attempts: Math.max(0, Number(raw.attempts) || 0),
      expiresAtMs: Number(raw.expiresAt) || 0,
    };
  } catch {
    otpMetrics.miss += 1;
    return null;
  }
}

export async function bumpResetOtpAttemptsInRedis(userId) {
  const redis = await redisClient();
  if (!redis) return null;
  try {
    const n = await redis.hincrby(otpResetRedisKey(userId), "attempts", 1);
    return Number(n);
  } catch {
    return null;
  }
}

export async function deleteResetOtpFromRedis(userId) {
  const redis = await redisClient();
  if (!redis) return;
  try {
    await redis.del(otpResetRedisKey(userId));
  } catch {
    // ignore
  }
}

export function markOtpLockedMetric() {
  otpMetrics.lock += 1;
}

/**
 * @returns {Promise<boolean>} true if cooldown active
 */
export async function isResetOtpCooldownActive(userId) {
  const redis = await redisClient();
  if (!redis) return false;
  try {
    const n = await redis.exists(otpCooldownRedisKey(userId));
    return Number(n) > 0;
  } catch {
    return false;
  }
}
