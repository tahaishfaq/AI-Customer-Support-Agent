/**
 * Rate-limit fail-closed behavior when Redis enabled but unavailable (AIDE-GAP-007).
 */
import assert from "node:assert/strict";
import {
  rateLimit,
  rateLimitMemory,
  __resetRateLimitMemoryForTests,
} from "../lib/rate-limit.js";
import { __resetRedisClientForTests } from "../lib/redis/client.js";

__resetRateLimitMemoryForTests();

const mem = rateLimitMemory("t:a", { limit: 2, windowMs: 60_000 });
assert.equal(mem.ok, true);
assert.equal(rateLimitMemory("t:a", { limit: 2, windowMs: 60_000 }).ok, true);
assert.equal(rateLimitMemory("t:a", { limit: 2, windowMs: 60_000 }).ok, false);
assert.equal(rateLimitMemory("t:b", { limit: 2, windowMs: 60_000 }).ok, true);
console.log("ok  memory threshold + key separation");

const prevEnabled = process.env.REDIS_ENABLED;
const prevUrl = process.env.REDIS_URL;
process.env.REDIS_ENABLED = "1";
process.env.REDIS_URL = "redis://127.0.0.1:1"; // almost certainly closed
__resetRedisClientForTests();

const closed = await rateLimit("fail-closed:test", {
  limit: 100,
  windowMs: 60_000,
  failClosed: true,
});
assert.equal(closed.ok, false);
assert.equal(closed.failClosed, true);
console.log("ok  redis fail-closed when unavailable");

process.env.REDIS_ENABLED = "0";
__resetRedisClientForTests();
const open = await rateLimit("fail-open:dev", {
  limit: 5,
  windowMs: 60_000,
  failClosed: false,
});
assert.equal(open.ok, true);
assert.equal(open.backend, "memory");
console.log("ok  memory fallback when redis disabled");

if (prevEnabled === undefined) delete process.env.REDIS_ENABLED;
else process.env.REDIS_ENABLED = prevEnabled;
if (prevUrl === undefined) delete process.env.REDIS_URL;
else process.env.REDIS_URL = prevUrl;
__resetRedisClientForTests();

console.log("\nrate-limit gap suite passed");
