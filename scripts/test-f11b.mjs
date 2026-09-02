/**
 * F11 Phase B smoke — CRUD wiring, SSRF, HTTP executor demo.
 * Run: npm run test:f11b
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertActionUrlSafe, isBlockedHostname } from "../lib/actions/ssrf.js";
import {
  executeHttpAction,
  resolveTemplate,
} from "../lib/actions/http-executor.js";
import {
  createAgentActionSchema,
  testAgentActionSchema,
} from "../lib/validations/actions.js";

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
  assert(
    /Phase B — Design & functionality ✅/.test(f11),
    "F11 Phase B should be marked done"
  );
  console.log("ok  F11-B doc scope");
}

function testSourceWiring() {
  const paths = [
    "lib/services/action.service.js",
    "lib/validations/actions.js",
    "lib/actions/ssrf.js",
    "lib/actions/http-executor.js",
    "lib/api/actions.js",
    "app/api/agents/[id]/actions/route.js",
    "app/api/agents/[id]/actions/[actionId]/route.js",
    "app/api/agents/[id]/actions/[actionId]/test/route.js",
    "app/api/demo/orders/[id]/route.js",
  ];
  for (const rel of paths) {
    assert(exists(rel), `missing: ${rel}`);
  }

  const form = read("components/customization/ActionsForm.jsx");
  assert(/createAgentAction/.test(form) && /testAgentAction/.test(form), "ActionsForm CRUD + test");
  assert(/Add HTTP tool/.test(form), "ActionsForm add button");
  console.log("ok  F11-B source wiring");
}

function testSsrf() {
  assert(isBlockedHostname("169.254.169.254"), "metadata IP blocked");
  assert(isBlockedHostname("127.0.0.1"), "loopback blocked by default");
  assert(isBlockedHostname("10.0.0.5"), "private 10/8 blocked");
  assert(!isBlockedHostname("api.myshop.com"), "public host ok");

  let threw = false;
  try {
    assertActionUrlSafe("https://169.254.169.254/latest/meta-data");
  } catch (err) {
    threw = err.code === "SSRF_BLOCKED";
  }
  assert(threw, "metadata https blocked");

  const local = assertActionUrlSafe("http://localhost:3000/api/demo/orders/1", {
    allowLocalDemo: true,
  });
  assert(local.hostname === "localhost", "local demo allowed when flagged");

  threw = false;
  try {
    assertActionUrlSafe("http://localhost:3000/api/demo/orders/1", {
      allowLocalDemo: false,
    });
  } catch (err) {
    threw = err.code === "SSRF_BLOCKED";
  }
  assert(threw, "localhost blocked without allowLocalDemo");
  console.log("ok  SSRF guards");
}

async function testExecutorDemo() {
  const resolved = resolveTemplate(
    "http://localhost:3000/api/demo/orders/{{orderId}}",
    { orderId: "ORD-100" }
  );
  assert(
    resolved === "http://localhost:3000/api/demo/orders/ORD-100",
    `template resolve got ${resolved}`
  );

  const result = await executeHttpAction({
    method: "GET",
    urlTemplate: "http://localhost:3000/api/demo/orders/{{orderId}}",
    args: { orderId: "ORD-100" },
    allowLocalDemo: true,
  });
  assert(result.ok && result.demo, "demo order in-process");
  assert(/Shipped/.test(result.bodyText), "demo body has status");

  const blocked = await executeHttpAction({
    method: "GET",
    urlTemplate: "https://169.254.169.254/latest",
    args: {},
    allowLocalDemo: false,
  });
  assert(blocked.status === "SSRF_BLOCKED", "executor SSRF block");
  console.log("ok  HTTP executor demo + SSRF");
}

function testValidation() {
  const ok = createAgentActionSchema.safeParse({
    name: "get_order_status",
    description: "Lookup order",
    method: "GET",
    urlTemplate: "https://api.myshop.com/orders/{{orderId}}",
  });
  assert(ok.success, "create schema accepts https action");

  const bad = createAgentActionSchema.safeParse({
    name: "get_order_status",
    description: "Lookup",
    urlTemplate: "ftp://files.example.com/x",
  });
  assert(!bad.success, "ftp rejected");

  const testArgs = testAgentActionSchema.safeParse({
    args: { orderId: "ORD-100" },
  });
  assert(testArgs.success, "test args schema");
  console.log("ok  action validation");
}

async function main() {
  testDocScope();
  testSourceWiring();
  testSsrf();
  await testExecutorDemo();
  testValidation();
  console.log("\nF11-B smoke passed");
}

main().catch((error) => {
  console.error("\nF11-B smoke FAILED:", error.message || error);
  process.exit(1);
});
