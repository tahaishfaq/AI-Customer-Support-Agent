/**
 * R6 crawl queue + per-agent lock — no live Redis/DB required.
 * Run: npm run test:crawl-queue
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  __setCrawlLockRedisForTests,
  acquireCrawlLock,
  releaseCrawlLock,
} from "../lib/jobs/crawl-lock.js";
import { CRAWL_JOBS, isBullMqEnabled } from "../lib/jobs/queues.js";
import { handleCrawlJob } from "../lib/jobs/handlers.js";
import { crawlLockRedisKey } from "../lib/redis/keys.js";

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
    store,
    async set(key, value, mode, sec, nx) {
      assert.equal(mode, "EX");
      assert.equal(nx, "NX");
      if (alive(key)) return null;
      store.set(key, {
        value: String(value),
        expiresAt: Date.now() + Number(sec) * 1000,
      });
      return "OK";
    },
    async get(key) {
      return alive(key)?.value ?? null;
    },
    async del(key) {
      store.delete(key);
      return 1;
    },
    async eval(script, numKeys, key, token) {
      assert.equal(numKeys, 1);
      const cur = await this.get(key);
      if (cur === token) return this.del(key);
      return 0;
    },
  };
}

async function testCrawlLock() {
  const fake = createFakeRedis();
  __setCrawlLockRedisForTests(fake);
  const agentId = "agent_crawl_1";

  const a = await acquireCrawlLock(agentId, { ttlSec: 120 });
  assert.equal(a.ok, true);
  assert.equal(a.backend, "redis");
  assert.ok(a.token);

  const b = await acquireCrawlLock(agentId, { ttlSec: 120 });
  assert.equal(b.ok, false);

  await releaseCrawlLock(agentId, a.token);
  assert.equal(await fake.get(crawlLockRedisKey(agentId)), null);

  const c = await acquireCrawlLock(agentId, { ttlSec: 120 });
  assert.equal(c.ok, true);
  await releaseCrawlLock(agentId, c.token);

  __setCrawlLockRedisForTests(null);
  console.log("ok  crawl lock acquire/release");
}

async function testHandlerValidation() {
  const unknown = await handleCrawlJob({
    name: "NOPE",
    data: { siteCrawlJobId: "j1", agentId: "a1" },
  });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.error, "unknown_crawl_job");

  const bad = await handleCrawlJob({
    name: CRAWL_JOBS.RUN_SITE_CRAWL,
    data: {},
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, "invalid_crawl_payload");
  assert.equal(isBullMqEnabled(), false);
  console.log("ok  crawl handler validation");
}

function testWiring() {
  const enqueue = read("lib/jobs/enqueue.js");
  assert.match(enqueue, /enqueueSiteCrawlJob/);
  assert.match(enqueue, /CRAWL_JOBS\.RUN_SITE_CRAWL/);
  assert.doesNotMatch(
    enqueue.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""),
    /\bhtml\b|password|otp\b/i
  );

  const worker = read("workers/job-worker.mjs");
  assert.match(worker, /handleCrawlJob/);
  assert.match(worker, /WORKER_CONCURRENCY_CRAWL/);

  const ping = read("app/api/public/agents/[publicKey]/ping/route.js");
  assert.match(ping, /enqueueSiteCrawlJob/);
  assert.match(ping, /isBullMqEnabled/);
  assert.match(ping, /runCrawlJob/);

  const keys = read("lib/redis/keys.js");
  assert.match(keys, /crawlLockRedisKey/);

  const lock = read("lib/jobs/crawl-lock.js");
  assert.match(lock, /SET NX|NX/);

  console.log("ok  crawl queue wiring");
}

testWiring();
await testCrawlLock();
await testHandlerValidation();
console.log("crawl-queue: ok");
