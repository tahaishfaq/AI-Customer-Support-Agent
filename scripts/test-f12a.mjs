/**
 * F12 Phase A smoke — desk scope locked; schema + helpers present.
 * Run: npm run test:f12a
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONVERSATION_STATUS,
  DEFAULT_HANDOFF_KEYWORDS,
  canActAsHuman,
  canTriggerHandoff,
  isAiPaused,
  isPublicMessageRole,
  isWaitingForHuman,
  serializeDeskState,
} from "../lib/desk/conversation-desk.js";

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
  const f12 = read("docs/features/F12_HUMAN_DESK.md");
  assert(
    /Phase A — Scope & identity ✅/.test(f12),
    "F12 Phase A should be marked done in plan"
  );
  assert(
    /WAITING_HUMAN/.test(f12) && /HUMAN/.test(f12),
    "F12 plan must name desk statuses and HUMAN role"
  );
  assert(
    /Platform admin answering user chats/.test(f12),
    "F12-A must keep admin inspect-only out of scope"
  );
  console.log("ok  F12-A doc scope");
}

function testSchemaContracts() {
  const schema = read("prisma/schema.prisma");
  assert(
    /enum ConversationStatus/.test(schema) &&
      schema.includes("OPEN") &&
      schema.includes("WAITING_HUMAN") &&
      schema.includes("RESOLVED"),
    "ConversationStatus enum must exist"
  );
  assert(
    /enum MessageRole[\s\S]*HUMAN/.test(schema),
    "MessageRole must include HUMAN"
  );
  assert(
    schema.includes("handoffReason") &&
      schema.includes("handoffAt") &&
      schema.includes("assignedUserId") &&
      schema.includes("aiPaused"),
    "Conversation must have handoff fields"
  );
  assert(
    exists("prisma/migrations/20260823210000_f12_conversation_desk/migration.sql"),
    "F12 migration must exist"
  );
  console.log("ok  prisma schema + migration");
}

function testDeskHelpers() {
  assert(
    CONVERSATION_STATUS.OPEN === "OPEN" &&
      CONVERSATION_STATUS.WAITING_HUMAN === "WAITING_HUMAN",
    "conversation status constants"
  );
  assert(DEFAULT_HANDOFF_KEYWORDS.length >= 3, "default handoff keywords");

  const open = { status: "OPEN", aiPaused: false };
  assert(canTriggerHandoff(open), "OPEN can handoff");
  assert(!isAiPaused(open), "OPEN is not ai paused");
  assert(!isWaitingForHuman(open), "OPEN is not waiting");

  const waiting = { status: "WAITING_HUMAN", aiPaused: true };
  assert(!canTriggerHandoff(waiting), "waiting cannot re-handoff yet");
  assert(isAiPaused(waiting), "waiting blocks AI");
  assert(isWaitingForHuman(waiting), "waiting flag");

  assert(
    canActAsHuman({ userId: "u1", agent: { userId: "u1" } }),
    "owner can act as human"
  );
  assert(
    !canActAsHuman({ userId: "u2", agent: { userId: "u1" } }),
    "non-owner cannot act as human"
  );
  assert(isPublicMessageRole("USER"), "public USER ok");
  assert(!isPublicMessageRole("HUMAN"), "public cannot send HUMAN");

  const serialized = serializeDeskState(waiting);
  assert(serialized.waitingForHuman && serialized.aiPaused, "serialize desk state");
  console.log("ok  desk helper contracts");
}

function testHotPaths() {
  const paths = [
    "lib/desk/conversation-desk.js",
    "lib/services/conversation.service.js",
    "app/api/public/agents/[publicKey]/conversations/[conversationId]/route.js",
  ];
  for (const rel of paths) {
    assert(exists(rel), `missing hot path: ${rel}`);
  }

  const conversationService = read("lib/services/conversation.service.js");
  assert(
    conversationService.includes("serializeDeskState"),
    "conversation service must expose desk state"
  );

  const publicRoute = read(
    "app/api/public/agents/[publicKey]/conversations/[conversationId]/route.js"
  );
  assert(
    publicRoute.includes("serializeDeskState"),
    "public conversation route must expose desk fields via serializeDeskState"
  );
  console.log("ok  hot-path files");
}

function main() {
  testDocScope();
  testSchemaContracts();
  testDeskHelpers();
  testHotPaths();
  console.log("\nF12-A smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF12-A smoke FAILED:", error.message);
  process.exit(1);
}
