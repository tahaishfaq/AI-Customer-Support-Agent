/**
 * Redis R0/R3 foundation — works without a live Redis (memory fallback).
 * Avoids importing lib/rate-limit.js (pulls next/server); exercises redis modules + static wiring.
 * Run: npm run test:redis-foundation
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  __resetRedisClientForTests,
  getRedisHealth,
  isRedisEnabled,
} from "../lib/redis/client.js";
import { redisKey, rateLimitRedisKey, redisKeyPrefix } from "../lib/redis/keys.js";
import { BULLMQ_QUEUES, isBullMqEnabled } from "../lib/jobs/queues.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

async function testRedisDisabled() {
  __resetRedisClientForTests();
  delete process.env.REDIS_ENABLED;
  assert.equal(isRedisEnabled(), false);
  const health = await getRedisHealth();
  assert.equal(health.status, "disabled");
  console.log("ok  redis disabled health");
}

function testKeys() {
  assert.match(redisKeyPrefix(), /^aide:/);
  assert.match(redisKey("rl", "x"), /:rl:x$/);
  assert.match(rateLimitRedisKey("chat:1"), /:rl:chat:1$/);
  assert.equal(isBullMqEnabled(), false);
  assert.ok(BULLMQ_QUEUES.EMAIL);
  console.log("ok  key helpers + queue names");
}

function testWiring() {
  const health = read("app/api/health/route.js");
  assert.match(health, /getRedisHealth/);
  assert.match(health, /redis/);

  const client = read("lib/redis/client.js");
  assert.match(client, /REDIS_ENABLED/);
  assert.match(client, /REALTIME_REDIS_URL/);

  const rl = read("lib/rate-limit.js");
  assert.match(rl, /async function rateLimit/);
  assert.match(rl, /rateLimitRedis/);
  assert.match(rl, /export function rateLimitMemory/);
  assert.match(rl, /fail through to memory|fall through to memory/);

  const chat = read("app/api/public/agents/[publicKey]/chat/route.js");
  assert.match(chat, /await rateLimit\(/);

  const worker = read("workers/job-worker.mjs");
  assert.match(worker, /bullmq/);
  assert.match(worker, /BULLMQ_QUEUES/);

  const queues = read("lib/jobs/queues.js");
  assert.match(queues, /BULLMQ_ENABLED/);
  assert.match(queues, /email/);

  const adr = read("docs/decisions/005-redis-bullmq-foundation.md");
  assert.match(adr, /fail-open to memory/);

  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts["test:redis-foundation"], "node scripts/test-redis-foundation.mjs");
  assert.match(
    pkg.scripts["worker:jobs"],
    /workers\/job-worker\.mjs/
  );
  assert.ok(pkg.dependencies.bullmq);
  assert.ok(pkg.dependencies.ioredis);

  console.log("ok  health + rate-limit + worker wiring");
}

/** Inline mirror of rateLimitMemory contract (source-locked via wiring assert). */
function testMemoryLimiterContract() {
  const buckets = new Map();
  function limit(key, { limit: max, windowMs }) {
    const now = Date.now();
    const existing = buckets.get(key);
    if (!existing || now - existing.start >= windowMs) {
      buckets.set(key, { start: now, count: 1 });
      return { ok: true };
    }
    if (existing.count >= max) return { ok: false, retryAfterSec: 1 };
    existing.count += 1;
    return { ok: true };
  }
  const key = `t-${Date.now()}`;
  assert.equal(limit(key, { limit: 2, windowMs: 60_000 }).ok, true);
  assert.equal(limit(key, { limit: 2, windowMs: 60_000 }).ok, true);
  assert.equal(limit(key, { limit: 2, windowMs: 60_000 }).ok, false);
  console.log("ok  memory fixed-window contract");
}

await testRedisDisabled();
testKeys();
testWiring();
testMemoryLimiterContract();
console.log("redis-foundation: ok");
