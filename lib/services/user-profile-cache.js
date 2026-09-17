/**
 * R2 — public user profile cache (Redis when REDIS_ENABLED=1).
 * Allowed: id, name, email, role, status, emailVerified, image, updatedAt.
 * Never cache passwordHash or secrets. Not PEP / identity authority.
 */

import { getConnectedRedis, isRedisEnabled } from "../redis/client.js";
import { profileRedisKey } from "../redis/keys.js";

export const PROFILE_SELECT = Object.freeze({
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  emailVerified: true,
  image: true,
  updatedAt: true,
});

/** @type {{ hit: number, miss: number, fill: number, invalidate: number }} */
export const profileCacheMetrics = {
  hit: 0,
  miss: 0,
  fill: 0,
  invalidate: 0,
};

/** @type {null | { get: Function, set: Function, del: Function }} */
let redisOverride = null;
/** @type {null | ((userId: string) => Promise<object|null>)} */
let loaderOverride = null;

export function __setProfileRedisForTests(fake) {
  redisOverride = fake;
}

export function __setProfileLoaderForTests(fn) {
  loaderOverride = fn;
}

export function __resetProfileCacheMetricsForTests() {
  profileCacheMetrics.hit = 0;
  profileCacheMetrics.miss = 0;
  profileCacheMetrics.fill = 0;
  profileCacheMetrics.invalidate = 0;
}

export function profileCacheTtlSec() {
  const n = Number(process.env.PROFILE_CACHE_TTL_SEC);
  if (Number.isFinite(n) && n >= 60 && n <= 300) return Math.trunc(n);
  return 120;
}

async function redisClient() {
  if (redisOverride) return redisOverride;
  if (!isRedisEnabled()) return null;
  return getConnectedRedis();
}

function serializeProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role || "USER",
    status: row.status || "ACTIVE",
    emailVerified: row.emailVerified
      ? new Date(row.emailVerified).toISOString()
      : null,
    image: row.image || null,
    updatedAt: row.updatedAt
      ? new Date(row.updatedAt).toISOString()
      : null,
  };
}

function deserializeProfile(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    id: String(raw.id || ""),
    name: raw.name ?? null,
    email: raw.email ?? null,
    role: raw.role || "USER",
    status: raw.status || "ACTIVE",
    emailVerified: raw.emailVerified || null,
    image: raw.image || null,
    updatedAt: raw.updatedAt || null,
  };
}

async function readCache(userId) {
  const redis = await redisClient();
  if (!redis) return null;
  try {
    const raw = await redis.get(profileRedisKey(userId));
    if (!raw) return null;
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return deserializeProfile(parsed);
  } catch {
    return null;
  }
}

async function writeCache(userId, profile) {
  const redis = await redisClient();
  if (!redis || !profile) return false;
  try {
    await redis.set(
      profileRedisKey(userId),
      JSON.stringify(profile),
      "EX",
      profileCacheTtlSec()
    );
    return true;
  } catch {
    return false;
  }
}

async function loadFromDb(userId) {
  if (loaderOverride) return loaderOverride(userId);
  const { default: prisma } = await import("../prisma.js");
  return prisma.user.findUnique({
    where: { id: userId },
    select: PROFILE_SELECT,
  });
}

/**
 * Load public user profile — Redis hit or Prisma fill.
 * @returns {Promise<null | {
 *   id: string, name: string|null, email: string|null, role: string,
 *   status: string, emailVerified: string|null, image: string|null, updatedAt: string|null
 * }>}
 */
export async function getCachedPublicUser(userId) {
  const id = String(userId || "").trim();
  if (!id) return null;

  const cached = await readCache(id);
  if (cached?.id) {
    profileCacheMetrics.hit += 1;
    return cached;
  }

  profileCacheMetrics.miss += 1;
  const row = await loadFromDb(id);
  if (!row) return null;

  const profile = serializeProfile(row);
  const wrote = await writeCache(id, profile);
  if (wrote) profileCacheMetrics.fill += 1;
  return profile;
}

export async function invalidatePublicUserCache(userId) {
  const id = String(userId || "").trim();
  if (!id) return;
  const redis = await redisClient();
  if (!redis) return;
  try {
    await redis.del(profileRedisKey(id));
    profileCacheMetrics.invalidate += 1;
  } catch {
    // ignore
  }
}
