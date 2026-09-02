/**
 * F12 Phase B smoke — handoff APIs, AI gate, inbox UI, embed handoff.
 * Run: npm run test:f12b
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

function main() {
  const f12 = read("docs/features/F12_HUMAN_DESK.md");
  assert(/Phase B — Design & functionality ✅/.test(f12), "F12 Phase B marked done");

  const routes = [
    "app/api/inbox/route.js",
    "app/api/conversations/[id]/handoff/route.js",
    "app/api/conversations/[id]/resolve/route.js",
    "app/api/conversations/[id]/messages/route.js",
    "app/api/public/agents/[publicKey]/conversations/[conversationId]/handoff/route.js",
  ];
  for (const rel of routes) {
    assert(exists(rel), `missing route: ${rel}`);
  }
  console.log("ok  desk API routes");

  const handoff = read("lib/services/handoff.service.js");
  assert(
    handoff.includes("triggerHandoff") &&
      handoff.includes("sendHumanReply") &&
      handoff.includes("listInboxForUser"),
    "handoff.service exports core functions"
  );

  const chat = read("lib/services/chat.service.js");
  assert(
    chat.includes("isAiPaused") && chat.includes("waitingForHuman"),
    "chat.service must gate AI when desk paused"
  );
  console.log("ok  services");

  const embed = read("components/embed/PublicWebchat.jsx");
  assert(
    embed.includes("Talk to a human") &&
      embed.includes("showHandoffCta") &&
      embed.includes("waitingForHuman") &&
      embed.includes("/handoff"),
    "embed must support gated handoff CTA + waiting banner"
  );

  assert(exists("app/(app)/inbox/page.jsx"), "inbox page");
  assert(exists("components/desk/DeskThread.jsx"), "desk thread UI");
  console.log("ok  inbox + embed UI");

  const nav = read("components/layout/nav.js");
  assert(nav.includes('"/inbox"'), "nav must link human desk");
  console.log("ok  navigation");

  console.log("\nF12-B smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF12-B smoke FAILED:", error.message);
  process.exit(1);
}
