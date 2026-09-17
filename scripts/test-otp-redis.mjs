/**
 * R1 OTP Redis dual-write — fake Redis, no live Redis or DB required.
 * Run: npm run test:otp-redis
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  __resetOtpMetricsForTests,
  __setOtpRedisForTests,
  bumpResetOtpAttemptsInRedis,
  deleteResetOtpFromRedis,
  isResetOtpCooldownActive,
  otpMetrics,
  readResetOtpFromRedis,
  writeResetOtpToRedis,
} from "../lib/email/otp-redis.js";
import { otpCooldownRedisKey, otpResetRedisKey } from "../lib/redis/keys.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function hashEmailToken(raw) {
  return createHash("sha256").update(String(raw), "utf8").digest("hex");
}

/** Minimal ioredis-shaped fake for HASH + SET EX + EXISTS. */
function createFakeRedis() {
  /** @type {Map<string, { type: "hash"|"string", value: any, expiresAt: number|null }>} */
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
    async del(key) {
      store.delete(key);
      return 1;
    },
    async hset(key, fields) {
      const prev = alive(key);
      const row = {
        type: "hash",
        value: { ...(prev?.type === "hash" ? prev.value : {}), ...fields },
        expiresAt: prev?.expiresAt ?? null,
      };
      store.set(key, row);
      return Object.keys(fields).length;
    },
    async hgetall(key) {
      const row = alive(key);
      if (!row || row.type !== "hash") return {};
      return { ...row.value };
    },
    async hincrby(key, field, by) {
      const row = alive(key);
      if (!row || row.type !== "hash") return 0;
      const next = (Number(row.value[field]) || 0) + by;
      row.value[field] = String(next);
      return next;
    },
    async expire(key, sec) {
      const row = alive(key);
      if (!row) return 0;
      row.expiresAt = Date.now() + sec * 1000;
      return 1;
    },
    async set(key, value, mode, sec) {
      assert.equal(mode, "EX");
      store.set(key, {
        type: "string",
        value: String(value),
        expiresAt: Date.now() + Number(sec) * 1000,
      });
      return "OK";
    },
    async exists(key) {
      return alive(key) ? 1 : 0;
    },
  };
}

async function testDualWriteHashOnly() {
  __resetOtpMetricsForTests();
  const fake = createFakeRedis();
  __setOtpRedisForTests(fake);

  process.env.EMAIL_RESET_RESEND_COOLDOWN_SEC = "60";
  const userId = "user_r1_1";
  const raw = "123456";
  const tokenHash = hashEmailToken(raw);
  const ok = await writeResetOtpToRedis({
    userId,
    tokenId: "tok_1",
    tokenHash,
    expiresAtMs: Date.now() + 300_000,
    ttlSec: 300,
  });
  assert.equal(ok, true);
  assert.equal(otpMetrics.write, 1);

  const dump = await fake.hgetall(otpResetRedisKey(userId));
  assert.equal(dump.tokenHash, tokenHash);
  assert.ok(
    !JSON.stringify(dump).includes(raw),
    "raw OTP must not appear in Redis dump"
  );
  assert.equal(dump.attempts, "0");
  assert.equal(await isResetOtpCooldownActive(userId), true);
  assert.equal(await fake.exists(otpCooldownRedisKey(userId)), 1);

  const cached = await readResetOtpFromRedis(userId);
  assert.equal(cached.tokenHash, tokenHash);
  assert.equal(otpMetrics.hit, 1);

  const attempts = await bumpResetOtpAttemptsInRedis(userId);
  assert.equal(attempts, 1);
  await deleteResetOtpFromRedis(userId);
  assert.equal(await readResetOtpFromRedis(userId), null);
  assert.ok(otpMetrics.miss >= 1);

  console.log("ok  dual-write hash-only + cooldown + attempts");
}

async function testAttemptsThreshold() {
  __resetOtpMetricsForTests();
  const fake = createFakeRedis();
  __setOtpRedisForTests(fake);
  process.env.EMAIL_RESET_RESEND_COOLDOWN_SEC = "0";

  const userId = "user_r1_lock";
  await writeResetOtpToRedis({
    userId,
    tokenId: "tok_lock",
    tokenHash: hashEmailToken("999999"),
    expiresAtMs: Date.now() + 60_000,
    ttlSec: 60,
  });
  for (let i = 0; i < 5; i++) {
    await bumpResetOtpAttemptsInRedis(userId);
  }
  const row = await readResetOtpFromRedis(userId);
  assert.equal(row.attempts, 5);
  console.log("ok  attempts counter reaches lock threshold");
}

function testWiring() {
  const tokens = read("lib/email/tokens.js");
  assert.match(tokens, /writeResetOtpToRedis/);
  assert.match(tokens, /readResetOtpFromRedis/);
  assert.match(tokens, /consumeViaPostgres/);
  assert.match(tokens, /isResetOtpCooldownActive/);

  const keys = read("lib/redis/keys.js");
  assert.match(keys, /otpResetRedisKey/);
  assert.match(keys, /otpCooldownRedisKey/);

  const otp = read("lib/email/otp-redis.js");
  assert.match(otp, /otpMetrics/);
  assert.match(otp, /hit/);
  assert.match(otp, /miss/);
  assert.match(otp, /lock/);

  const plan = read("docs/features/REDIS_BULLMQ_ENTERPRISE_PLAN.md");
  assert.match(plan, /Phase R1/);

  assert.equal(hashEmailToken("000000").length, 64);
  console.log("ok  tokens dual-write wiring");
}

__setOtpRedisForTests(null);
testWiring();
await testDualWriteHashOnly();
await testAttemptsThreshold();
__setOtpRedisForTests(null);
console.log("otp-redis: ok");
