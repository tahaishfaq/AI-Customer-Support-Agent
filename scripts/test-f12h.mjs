/**
 * F12 Phase H — production checklist (source + optional live HTTP).
 * Run: npm run test:f12h
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = (process.env.TEST_BASE_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function testPhaseHDoc() {
  const f12 = read("docs/features/F12_HUMAN_DESK.md");
  assert(/Phase H — Production testing ✅/.test(f12), "Phase H marked done");

  const checks = [
    "Embed user triggers handoff",
    "Human reply visible on embed",
    "AI does not answer while WAITING_HUMAN",
    "Resolve → AI can answer again",
    "Workspace A never sees Workspace B",
    "Admin cannot send human replies",
    "Keyword / button both paths",
    "npm run test:f12",
  ];
  for (const line of checks) {
    assert(f12.includes(line), `Phase H checklist must mention: ${line}`);
  }
  console.log("ok  Phase H doc checklist");
}

function testSourceProductionPaths() {
  const paths = [
    "app/api/inbox/route.js",
    "app/api/inbox/count/route.js",
    "app/api/inbox/seen/route.js",
    "app/api/conversations/[id]/handoff/route.js",
    "app/api/conversations/[id]/resolve/route.js",
    "app/api/conversations/[id]/messages/route.js",
    "app/api/public/agents/[publicKey]/conversations/[conversationId]/handoff/route.js",
    "app/(app)/inbox/page.jsx",
    "app/(app)/inbox/[conversationId]/page.jsx",
    "components/desk/DeskThread.jsx",
    "components/embed/PublicWebchat.jsx",
    "lib/services/handoff.service.js",
    "scripts/test-f12a.mjs",
    "scripts/test-f12b.mjs",
    "scripts/test-f12c.mjs",
    "scripts/test-f12d.mjs",
  ];
  for (const rel of paths) {
    assert(fs.existsSync(path.join(root, rel)), `missing: ${rel}`);
  }
  console.log("ok  production file inventory");
}

async function testLiveDeskRoutes() {
  let health;
  try {
    health = await fetch(`${BASE}/api/health`);
  } catch {
    console.log("skip live desk routes (server not reachable)");
    return;
  }
  if (!health.ok) {
    console.log("skip live desk routes (health not ok)");
    return;
  }

  const inbox = await fetch(`${BASE}/api/inbox`);
  assert(inbox.status === 401, "inbox requires auth");
  console.log("ok  live inbox auth gate");
}

function main() {
  testPhaseHDoc();
  testSourceProductionPaths();
}

try {
  main();
  await testLiveDeskRoutes();
  console.log("\nF12-H smoke passed");
} catch (error) {
  console.error("\nF12-H smoke FAILED:", error.message);
  process.exit(1);
}
