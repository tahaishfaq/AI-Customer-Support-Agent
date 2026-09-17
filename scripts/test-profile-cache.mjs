/**
 * R2 profile cache — fake Redis + loader, no DB required.
 * Run: npm run test:profile-cache
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  __resetProfileCacheMetricsForTests,
  __setProfileLoaderForTests,
  __setProfileRedisForTests,
  getCachedPublicUser,
  invalidatePublicUserCache,
  profileCacheMetrics,
  profileCacheTtlSec,
} from "../lib/services/user-profile-cache.js";
import { profileRedisKey } from "../lib/redis/keys.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function createFakeRedis() {
  /** @type {Map<string, { value: string, expiresAt: number|null }>} */
  const store = new Map();
  function alive(key) {
    const row = store.get(key);
    if (!row) return null;
    if (row.expiresAt != null && row.expiresAt <= Date.now()) {
      store.delete(key);
      return null;
    }
    return row;
  }
  return {
    async get(key) {
      return alive(key)?.value ?? null;
    },
    async set(key, value, mode, sec) {
      assert.equal(mode, "EX");
      store.set(key, {
        value: String(value),
        expiresAt: Date.now() + Number(sec) * 1000,
      });
      return "OK";
    },
    async del(key) {
      store.delete(key);
      return 1;
    },
  };
}

async function testMissFillHitInvalidate() {
  __resetProfileCacheMetricsForTests();
  const fake = createFakeRedis();
  __setProfileRedisForTests(fake);

  let loads = 0;
  __setProfileLoaderForTests(async (userId) => {
    loads += 1;
    return {
      id: userId,
      name: "Ada",
      email: "ada@example.com",
      role: "USER",
      status: "ACTIVE",
      emailVerified: new Date("2026-01-01T00:00:00.000Z"),
      image: null,
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    };
  });

  const userId = "user_r2_1";
  const a = await getCachedPublicUser(userId);
  assert.equal(a.name, "Ada");
  assert.equal(a.emailVerified, "2026-01-01T00:00:00.000Z");
  assert.equal(loads, 1);
  assert.equal(profileCacheMetrics.miss, 1);
  assert.equal(profileCacheMetrics.fill, 1);

  const raw = await fake.get(profileRedisKey(userId));
  assert.ok(raw);
  assert.ok(!raw.includes("password"), "no password fields");
  assert.ok(!raw.includes("passwordHash"));

  const b = await getCachedPublicUser(userId);
  assert.equal(b.name, "Ada");
  assert.equal(loads, 1, "second read must be cache hit");
  assert.equal(profileCacheMetrics.hit, 1);

  await invalidatePublicUserCache(userId);
  assert.equal(profileCacheMetrics.invalidate, 1);
  assert.equal(await fake.get(profileRedisKey(userId)), null);

  const c = await getCachedPublicUser(userId);
  assert.equal(c.name, "Ada");
  assert.equal(loads, 2, "after invalidate must refill");
  assert.equal(profileCacheMetrics.miss, 2);

  console.log("ok  miss→fill→hit→invalidate→refill");
}

function testWiring() {
  assert.ok(profileCacheTtlSec() >= 60 && profileCacheTtlSec() <= 300);

  const me = read("app/api/auth/me/route.js");
  assert.match(me, /getCachedPublicUser/);

  const fresh = read("lib/require-auth.js");
  assert.match(fresh, /getCachedPublicUser/);

  const admin = read("lib/require-admin.js");
  assert.match(admin, /getCachedPublicUser/);

  const billing = read("app/(billing)/layout.jsx");
  assert.match(billing, /getCachedPublicUser/);

  for (const rel of [
    "lib/services/admin-users.service.js",
    "lib/services/email-lifecycle.service.js",
    "lib/services/password-reset.service.js",
    "lib/services/restore-request.service.js",
  ]) {
    assert.match(read(rel), /invalidatePublicUserCache/, rel);
  }

  const keys = read("lib/redis/keys.js");
  assert.match(keys, /profileRedisKey/);

  console.log("ok  me/admin/auth + invalidate wiring");
}

testWiring();
await testMissFillHitInvalidate();
__setProfileRedisForTests(null);
__setProfileLoaderForTests(null);
console.log("profile-cache: ok");
