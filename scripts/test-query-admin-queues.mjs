/**
 * TanStack Q0 Devtools + admin queue counts — static wiring.
 * Run: npm run test:query-admin-queues
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAdminQueueCounts } from "../lib/services/admin-queues.service.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function testDevtoolsWiring() {
  const provider = read("components/query/QueryProvider.jsx");
  assert.match(provider, /QueryDevtools/);

  const devtools = read("components/query/QueryDevtools.jsx");
  assert.match(devtools, /ReactQueryDevtools/);
  assert.match(devtools, /NODE_ENV !== "development"/);

  const pkg = JSON.parse(read("package.json"));
  assert.ok(pkg.dependencies["@tanstack/react-query"]);
  assert.ok(pkg.dependencies["@tanstack/react-query-devtools"]);

  console.log("ok  Query Devtools wired (dev-only)");
}

function testAdminQueuesRoute() {
  const route = read("app/api/admin/queues/route.js");
  assert.match(route, /requireAdmin/);
  assert.match(route, /getAdminQueueCounts/);
  assert.doesNotMatch(route, /getJobs\(|job\.data/);

  const service = read("lib/services/admin-queues.service.js");
  assert.match(service, /getJobCounts/);
  assert.doesNotMatch(service, /password|otp|tokenHash/i);

  console.log("ok  admin queues route wiring");
}

async function testCountsWhenDisabled() {
  delete process.env.BULLMQ_ENABLED;
  const result = await getAdminQueueCounts();
  assert.equal(result.enabled, false);
  assert.ok(Array.isArray(result.queues));
  assert.ok(result.queues.length >= 4);
  assert.ok(result.queues.every((q) => typeof q.name === "string"));
  console.log("ok  queue counts when BullMQ disabled");
}

testDevtoolsWiring();
testAdminQueuesRoute();
await testCountsWhenDisabled();
console.log("query-admin-queues: ok");
