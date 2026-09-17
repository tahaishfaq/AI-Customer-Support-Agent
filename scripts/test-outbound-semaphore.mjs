/**
 * R3 outbound semaphore — shared Redis counter (fake) + memory fallback.
 * Run: npm run test:outbound-semaphore
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  __setOutboundSemRedisForTests,
  _resetOutboundGatesForTests,
  acquireOutboundSlot,
} from "../lib/actions/outbound-semaphore.js";
import { outboundSemRedisKey } from "../lib/redis/keys.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

/** Shared fake Redis with INCR/DECR/EXPIRE/DEL — simulates two app instances. */
function createFakeRedis() {
  /** @type {Map<string, { n: number, expiresAt: number|null }>} */
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
    store,
    async incr(key) {
      const row = alive(key) || { n: 0, expiresAt: null };
      row.n += 1;
      store.set(key, row);
      return row.n;
    },
    async decr(key) {
      const row = alive(key);
      if (!row) return 0;
      row.n -= 1;
      if (row.n <= 0) {
        store.delete(key);
        return 0;
      }
      store.set(key, row);
      return row.n;
    },
    async expire(key, sec) {
      const row = alive(key);
      if (!row) return 0;
      row.expiresAt = Date.now() + sec * 1000;
      return 1;
    },
    async del(key) {
      store.delete(key);
      return 1;
    },
  };
}

async function testMemoryFallback() {
  __setOutboundSemRedisForTests(null);
  _resetOutboundGatesForTests();
  const a = await acquireOutboundSlot("mem-agent", { max: 2, waitMs: 200 });
  const b = await acquireOutboundSlot("mem-agent", { max: 2, waitMs: 200 });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  const c = await acquireOutboundSlot("mem-agent", { max: 2, waitMs: 120 });
  assert.equal(c.ok, false);
  assert.equal(c.errorCode, "CONCURRENCY_LIMIT");
  a.release();
  b.release();
  const d = await acquireOutboundSlot("mem-agent", { max: 2, waitMs: 200 });
  assert.equal(d.ok, true);
  d.release();
  _resetOutboundGatesForTests();
  console.log("ok  memory fallback semaphore");
}

async function testSharedRedisTwoInstances() {
  const shared = createFakeRedis();
  // Instance A
  __setOutboundSemRedisForTests(shared);
  const a1 = await acquireOutboundSlot("shared-agent", { max: 2, waitMs: 100 });
  const a2 = await acquireOutboundSlot("shared-agent", { max: 2, waitMs: 100 });
  assert.equal(a1.ok && a2.ok, true);

  // Instance B sees the same counter (same fake store)
  __setOutboundSemRedisForTests(shared);
  const b1 = await acquireOutboundSlot("shared-agent", { max: 2, waitMs: 80 });
  assert.equal(b1.ok, false);
  assert.equal(b1.errorCode, "CONCURRENCY_LIMIT");

  const key = outboundSemRedisKey("shared-agent");
  assert.equal(shared.store.get(key)?.n, 2);

  a1.release();
  a2.release();
  // Allow async release
  await new Promise((r) => setTimeout(r, 20));
  const b2 = await acquireOutboundSlot("shared-agent", { max: 2, waitMs: 100 });
  assert.equal(b2.ok, true);
  b2.release();
  __setOutboundSemRedisForTests(null);
  console.log("ok  shared Redis counter across instances");
}

function testWiring() {
  const sem = read("lib/actions/outbound-semaphore.js");
  assert.match(sem, /ACQUIRE_LUA|INCR/);
  assert.match(sem, /outboundSemRedisKey/);
  assert.match(sem, /getConnectedRedis|isRedisEnabled/);

  const keys = read("lib/redis/keys.js");
  assert.match(keys, /outboundSemRedisKey/);

  const pub = read(
    "app/api/public/agents/[publicKey]/confirmations/[confirmationId]/route.js"
  );
  assert.match(pub, /await rateLimit\(/);
  assert.match(pub, /pubConfirmLimitOpts/);

  const studio = read(
    "app/api/conversations/[id]/confirmations/[confirmationId]/route.js"
  );
  assert.match(studio, /await rateLimit\(/);
  assert.match(studio, /studioConfirmLimitOpts/);

  console.log("ok  semaphore + confirm rate-limit wiring");
}

testWiring();
await testMemoryFallback();
await testSharedRedisTwoInstances();
console.log("outbound-semaphore: ok");
