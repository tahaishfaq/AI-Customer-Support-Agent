/**
 * R4 shared GET action cache — memory + fake Redis, no live Redis required.
 * Run: npm run test:get-cache-redis
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  GET_CACHE_MAX_BODY_CHARS,
  __setGetCacheRedisForTests,
  _getCacheSizeForTests,
  _resetGetCacheForTests,
  buildGetCacheKey,
  getCachedGetResult,
  setCachedGetResult,
} from "../lib/actions/get-cache.js";
import { actionGetCacheRedisKey } from "../lib/redis/keys.js";

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
  };
}

async function testSharedRedisHit() {
  _resetGetCacheForTests();
  const shared = createFakeRedis();
  __setGetCacheRedisForTests(shared);

  await setCachedGetResult("act-r4", { id: "1" }, {
    ok: true,
    status: "OK",
    httpStatus: 200,
    bodyText: '{"ok":true}',
  });

  // Clear memory — Redis should still serve
  _resetGetCacheForTests();
  assert.equal(_getCacheSizeForTests(), 0);

  const hit = await getCachedGetResult("act-r4", { id: "1" });
  assert.equal(hit?.ok, true);
  assert.equal(hit?.cached, true);
  assert.match(hit.bodyText, /ok/);

  const digest = buildGetCacheKey("act-r4", { id: "1" }).replace(/^get:/, "");
  assert.ok(shared.store.has(actionGetCacheRedisKey(digest)));

  __setGetCacheRedisForTests(null);
  _resetGetCacheForTests();
  console.log("ok  Redis GET cache shared after memory clear");
}

async function testOversizedSkipped() {
  _resetGetCacheForTests();
  __setGetCacheRedisForTests(createFakeRedis());
  const huge = "x".repeat(GET_CACHE_MAX_BODY_CHARS + 10);
  await setCachedGetResult("act-big", {}, {
    ok: true,
    status: "OK",
    httpStatus: 200,
    bodyText: huge,
  });
  assert.equal(await getCachedGetResult("act-big", {}), null);
  assert.equal(_getCacheSizeForTests(), 0);
  __setGetCacheRedisForTests(null);
  console.log("ok  oversized body not cached");
}

function testWiring() {
  const cache = read("lib/actions/get-cache.js");
  assert.match(cache, /actionGetCacheRedisKey/);
  assert.match(cache, /async function getCachedGetResult|export async function getCachedGetResult/);
  assert.match(cache, /MAX_BODY_CHARS|GET_CACHE_MAX_BODY_CHARS/);

  const invoke = read("lib/actions/invoke-tool.js");
  assert.match(invoke, /await getCachedGetResult/);
  assert.match(invoke, /await setCachedGetResult/);

  const action = read("lib/services/action.service.js");
  assert.match(action, /await getCachedGetResult/);
  assert.match(action, /await setCachedGetResult/);

  const keys = read("lib/redis/keys.js");
  assert.match(keys, /actionGetCacheRedisKey/);

  console.log("ok  get-cache Redis wiring");
}

testWiring();
await testSharedRedisHit();
await testOversizedSkipped();
console.log("get-cache-redis: ok");
