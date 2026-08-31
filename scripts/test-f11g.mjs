/**
 * F11 Phase F — scaling (daily workspace cap, GET cache, sync GET only).
 * Run: npm run test:f11g
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  _getCacheSizeForTests,
  _resetGetCacheForTests,
  buildGetCacheKey,
  getCachedGetResult,
  isGetMethod,
  setCachedGetResult,
} from "../lib/actions/get-cache.js";
import { actionWorkspaceDailyLimitOpts } from "../lib/rate-limit-config.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function testDocScope() {
  const f11 = read("docs/features/F11_AGENT_ACTIONS.md");
  assert(/Phase F — Scaling ✅/.test(f11), "F11 Phase F marked done");
  assert(/out of F11 MVP/i.test(f11), "long jobs still out of MVP");
  console.log("ok  F11-G doc scope");
}

function testSourceWiring() {
  assert(exists("lib/actions/get-cache.js"), "get-cache module");
  const loop = read("lib/actions/tool-loop.js");
  assert(/actionWorkspaceDailyLimitOpts|actions:daily:/.test(loop), "daily cap in loop");
  assert(/getCachedGetResult|setCachedGetResult/.test(loop), "GET cache in loop");
  assert(/workspaceId/.test(loop), "workspaceId threaded");

  const chat = read("lib/services/chat.service.js");
  assert(/actionRuntime|workspaceId/.test(chat), "chat passes workspace");

  const opts = actionWorkspaceDailyLimitOpts();
  assert(opts.limit >= 1 && opts.windowMs >= 60_000, "daily limit opts");

  console.log("ok  F11-G source wiring");
}

function testGetCache() {
  _resetGetCacheForTests();
  assert(isGetMethod("GET") && !isGetMethod("POST"), "method helpers");

  const key1 = buildGetCacheKey("act1", { orderId: "ORD-100" });
  const key2 = buildGetCacheKey("act1", { orderId: "ORD-100" });
  const key3 = buildGetCacheKey("act1", { orderId: "ORD-999" });
  assert(key1 === key2, "stable cache key");
  assert(key1 !== key3, "different args different key");

  assert(getCachedGetResult("act1", { orderId: "ORD-100" }) == null, "miss");

  setCachedGetResult("act1", { orderId: "ORD-100" }, {
    ok: true,
    status: "OK",
    httpStatus: 200,
    bodyText: '{"status":"Shipped"}',
    truncated: false,
  });
  const hit = getCachedGetResult("act1", { orderId: "ORD-100" });
  assert(hit?.ok && hit.cached && /Shipped/.test(hit.bodyText), "cache hit");
  assert(_getCacheSizeForTests() >= 1, "cache stores entry");

  setCachedGetResult("act1", { orderId: "bad" }, {
    ok: false,
    status: "ERROR",
    httpStatus: 500,
    bodyText: "nope",
  });
  assert(
    getCachedGetResult("act1", { orderId: "bad" }) == null,
    "errors not cached"
  );

  _resetGetCacheForTests();
  console.log("ok  F11-G GET cache");
}

function main() {
  testDocScope();
  testSourceWiring();
  testGetCache();
  console.log("\nAll F11-G checks passed.");
}

main();
