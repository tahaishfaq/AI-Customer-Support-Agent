/**
 * O01 Phase O3.1 — Streaming + tools (final text stream, tool progress SSE).
 * Run: npm run test:orchestrator-o31
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function testLoopStreaming() {
  const loop = read("lib/orchestrator/loop.js");
  assert(/streaming/.test(loop) && /onEvent/.test(loop), "loop accepts streaming/onEvent");
  assert(/chatCompletionStream/.test(loop), "final text can token-stream");
  assert(/type:\s*"tool"/.test(loop) || /type: "tool"/.test(loop), "emits tool progress");
  assert(/type:\s*"delta"/.test(loop) || /type: "delta"/.test(loop), "emits deltas");
  assert(!/executeHttpAction/.test(loop), "still no direct HTTP");
  console.log("ok  O3.1 loop streaming hooks");
}

function testChannelWiring() {
  const chat = read("lib/services/chat.service.js");
  assert(
    /canTokenStream = wantStream && !publicAccess/.test(chat),
    "stream allowed with tools (studio)"
  );
  assert(/onEvent:\s*canTokenStream/.test(chat), "passes onEvent into runTurn");
  assert(/streaming:\s*canTokenStream/.test(chat), "flags.streaming set");
  assert(
    !/if \(canTokenStream\) \{\s*const \{ chatCompletionStream \}/.test(chat),
    "no separate no-tools-only stream branch"
  );
  console.log("ok  O3.1 chat.service wiring");
}

function testClient() {
  const client = read("lib/api/chat-stream.js");
  assert(/onTool/.test(client), "client handles tool SSE events");
  assert(/O3\.1/.test(client), "client docs O3.1");
  console.log("ok  O3.1 client SSE");
}

function testDocs() {
  const plan = read("docs/features/ORCHESTRATOR_LAYER_PLAN.md");
  assert(/O3\.1/.test(plan), "plan mentions O3.1");
  const contract = read("docs/features/ORCHESTRATOR_CONTRACT.md");
  assert(/O3\.1|stream/i.test(contract), "contract mentions streaming");
  console.log("ok  O3.1 docs");
}

function main() {
  testLoopStreaming();
  testChannelWiring();
  testClient();
  testDocs();
  console.log("\nAll O3.1 orchestrator checks passed.");
}

main();
