/**
 * F11 Phase E — production bottlenecks (concurrency, GET-first, classify isolation).
 * Run: npm run test:f11f
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MAX_CONCURRENT_OUTBOUND, TOOL_LOOP_DEADLINE_MS, DEFAULT_ACTION_TIMEOUT_MS } from "../lib/actions/action-config.js";
import {
  _resetOutboundGatesForTests,
  acquireOutboundSlot,
  orderToolCallsGetFirst,
} from "../lib/actions/outbound-semaphore.js";

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
  assert(/Phase E — Production bottlenecks ✅/.test(f11), "F11 Phase E marked done");
  console.log("ok  F11-F doc scope");
}

function testSourceWiring() {
  assert(exists("lib/actions/outbound-semaphore.js"), "semaphore module");
  const loop = read("lib/actions/tool-loop.js");
  assert(/withOutboundSlot/.test(loop), "tool loop uses concurrency slot");
  assert(/orderToolCallsGetFirst/.test(loop), "GET-first ordering");

  const classify = read("lib/services/ai/classify.js");
  assert(!/tools|tool_choice|chatCompletionWithTools/.test(classify), "classify has no tools");

  const llm = read("lib/services/ai/llm.provider.js");
  assert(/classifyCompletion/.test(llm), "classifyCompletion exists");
  const classifyFn = llm.slice(llm.indexOf("export async function classifyCompletion"));
  assert(!/tools|tool_choice/.test(classifyFn.slice(0, 800)), "classifyCompletion no tools");

  assert(DEFAULT_ACTION_TIMEOUT_MS === 8000, "default per-tool timeout");
  assert(TOOL_LOOP_DEADLINE_MS === 25_000, "global loop deadline");
  assert(MAX_CONCURRENT_OUTBOUND === 2, "concurrent cap default 2");

  console.log("ok  F11-F source wiring");
}

async function testSemaphore() {
  _resetOutboundGatesForTests();
  const a = await acquireOutboundSlot("agent-e", { max: 2, waitMs: 200 });
  const b = await acquireOutboundSlot("agent-e", { max: 2, waitMs: 200 });
  assert(a.ok && b.ok, "two slots ok");

  const pending = acquireOutboundSlot("agent-e", { max: 2, waitMs: 150 });
  // Third should wait then fail if we don't release
  const c = await pending;
  assert(!c.ok && c.errorCode === "CONCURRENCY_LIMIT", "third times out");

  a.release();
  b.release();

  const d = await acquireOutboundSlot("agent-e", { max: 2, waitMs: 200 });
  assert(d.ok, "slot free after release");
  d.release();
  _resetOutboundGatesForTests();
  console.log("ok  F11-F semaphore");
}

function testGetFirst() {
  const byName = new Map([
    ["post_webhook", { method: "POST" }],
    ["get_order_status", { method: "GET" }],
  ]);
  const ordered = orderToolCallsGetFirst(
    [
      { id: "1", function: { name: "post_webhook" } },
      { id: "2", function: { name: "get_order_status" } },
    ],
    byName
  );
  assert(ordered[0].function.name === "get_order_status", "GET before POST");
  assert(ordered[1].function.name === "post_webhook", "POST second");
  console.log("ok  F11-F GET-first order");
}

async function main() {
  testDocScope();
  testSourceWiring();
  await testSemaphore();
  testGetFirst();
  console.log("\nAll F11-F checks passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
