import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const gateway = read("realtime-gateway/attach.js");
const contracts = read("realtime-gateway/runtime-contracts.js");
const publisher = read("workers/realtime-outbox-publisher.js");
const server = read("server.js");
const env = read("docs/features/REALTIME_ENVIRONMENT_CONTRACT.md");
const plan = read("docs/features/SOCKET_REALTIME_PLAN.md");
const packageJson = JSON.parse(read("package.json"));

assert.match(contracts, /maxConnectionsPerUser/);
assert.match(contracts, /maxConnectionsPerPublicConversation/);
assert.match(contracts, /connectionRateLimitPerMinute/);
assert.match(gateway, /Realtime capacity exceeded/);
assert.match(gateway, /Realtime identity capacity exceeded/);
assert.match(gateway, /Connection rate limit exceeded/);
assert.match(gateway, /consumer retrying/);
assert.match(gateway, /getMetrics\(\)/);
assert.match(gateway, /redisErrors/);
assert.match(publisher, /loop retrying/);
assert.match(publisher, /failure-state retry/);
assert.match(server, /pathname === "\/metrics"/);
assert.match(env, /REALTIME_CONNECTION_RATE_LIMIT_PER_MINUTE/);
assert.match(plan, /Redis outage/);
assert.equal(typeof packageJson.scripts["test:realtime-full"], "string");

console.log("Realtime Phase 6 hardening contracts passed");
