/**
 * F14-A smoke — in-chat Confirm UI + pending confirmation plumbing.
 * Run: npm run test:f14a
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
  assert(exists("lib/services/confirmation.service.js"), "confirmation.service");
  const svc = read("lib/services/confirmation.service.js");
  assert(/export async function denyConfirmation/.test(svc), "denyConfirmation");
  assert(/"DENIED"/.test(svc), "DENIED status write");
  assert(/status: "PENDING"/.test(svc), "PENDING reuse");

  const loop = read("lib/actions/tool-loop.js");
  assert(/createPendingConfirmation/.test(loop), "tool-loop creates pending");
  assert(/pendingConfirmation/.test(loop), "pendingConfirmation on tool step");
  assert(/CONFIRMATION_REQUIRED/.test(loop), "confirm gate");

  const chat = read("lib/services/chat.service.js");
  assert(/collectPendingConfirmations/.test(chat), "collect helper");
  assert(/pendingConfirmations/.test(chat), "chat returns pendingConfirmations");

  const appRoute = read(
    "app/api/conversations/[id]/confirmations/[confirmationId]/route.js"
  );
  assert(/denyConfirmation/.test(appRoute), "app deny");
  assert(/decision/.test(appRoute), "decision body");

  const pubRoute = read(
    "app/api/public/agents/[publicKey]/confirmations/[confirmationId]/route.js"
  );
  assert(/denyConfirmation/.test(pubRoute), "public deny");

  assert(exists("lib/api/confirmations.js"), "client confirmations API");
  assert(exists("components/chat/ActionConfirmCard.jsx"), "ActionConfirmCard");

  const bubble = read("components/chat/MessageBubble.jsx");
  assert(/ActionConfirmCard/.test(bubble), "bubble renders card");
  assert(/pendingConfirmations/.test(bubble), "bubble prop");

  const list = read("components/chat/MessageList.jsx");
  assert(/onConfirmDecision/.test(list), "MessageList wires decision");

  for (const rel of [
    "components/embed/PublicWebchat.jsx",
    "components/studio/AgentTestStudio.jsx",
    "components/chat/ChatWorkspace.jsx",
  ]) {
    const src = read(rel);
    assert(/pendingConfirmations/.test(src), `${rel} attaches pending`);
    assert(/handleConfirmDecision/.test(src), `${rel} handles confirm`);
  }

  const plan = read("docs/features/F14_END_USER_AUTH_AND_ACTION_CONSENT.md");
  assert(/Phase A/.test(plan) && /✅/.test(plan), "F14 plan marks A done");

  console.log("ok  confirmation deny + pending create");
  console.log("ok  chat pendingConfirmations + Confirm UI surfaces");
  console.log("\nF14-A smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF14-A smoke FAILED:", error.message);
  process.exit(1);
}
