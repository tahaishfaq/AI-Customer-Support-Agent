/**
 * R7 Socket↔Redis alignment — URL fallback + wiring (no live Redis required).
 * Run: npm run test:realtime-redis-align
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getGatewayConfig } from "../realtime-gateway/runtime-contracts.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function testUrlFallback() {
  const prev = {
    REALTIME_REDIS_URL: process.env.REALTIME_REDIS_URL,
    REDIS_URL: process.env.REDIS_URL,
    REALTIME_REDIS_USERNAME: process.env.REALTIME_REDIS_USERNAME,
    REDIS_USERNAME: process.env.REDIS_USERNAME,
  };

  delete process.env.REALTIME_REDIS_URL;
  process.env.REDIS_URL = "redis://127.0.0.1:6379/0";
  delete process.env.REALTIME_REDIS_USERNAME;
  process.env.REDIS_USERNAME = "aide-app";

  const cfg = getGatewayConfig();
  assert.equal(cfg.redisUrl, "redis://127.0.0.1:6379/0");
  assert.equal(cfg.redisUsername, "aide-app");

  process.env.REALTIME_REDIS_URL = "rediss://realtime.example:6380";
  const prefer = getGatewayConfig();
  assert.equal(prefer.redisUrl, "rediss://realtime.example:6380");

  for (const [k, v] of Object.entries(prev)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  console.log("ok  REALTIME_REDIS_URL falls back to REDIS_URL");
}

function testWiring() {
  const attach = read("realtime-gateway/attach.js");
  assert.match(attach, /createAdapter/);
  assert.match(attach, /REALTIME_REDIS_URL \(or REDIS_URL\)/);

  const contracts = read("realtime-gateway/runtime-contracts.js");
  assert.match(contracts, /REDIS_URL/);
  assert.match(contracts, /REDIS_USERNAME/);

  const envDoc = read("docs/features/REALTIME_ENVIRONMENT_CONTRACT.md");
  assert.match(envDoc, /Shared Redis connection budget/);
  assert.match(envDoc, /ephemeral only/i);

  const redisPlan = read("docs/features/REDIS_BULLMQ_ENTERPRISE_PLAN.md");
  assert.match(redisPlan, /Phase R7/);

  console.log("ok  adapter + pool docs wiring");
}

testUrlFallback();
testWiring();
console.log("realtime-redis-align: ok");
