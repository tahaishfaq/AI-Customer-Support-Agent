/**
 * F12-U U4 — Internal notes (source smoke).
 * Run: node scripts/test-f12u4.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DESK_MESSAGE_ROLE,
  isCustomerVisibleRole,
  isInternalNoteRole,
  isOwnerInternalNoteRole,
  isPublicMessageRole,
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

assert(exists("prisma/migrations/20260830020000_f12u_internal_notes/migration.sql"), "migration");
assert(exists("app/api/conversations/[id]/notes/route.js"), "notes API");

const schema = read("prisma/schema.prisma");
assert(/enum MessageRole[\s\S]*INTERNAL/.test(schema), "MessageRole.INTERNAL");

assert(DESK_MESSAGE_ROLE.INTERNAL === "INTERNAL", "INTERNAL constant");
assert(isInternalNoteRole("INTERNAL"), "isInternalNoteRole");
assert(isOwnerInternalNoteRole("INTERNAL"), "owner can note");
assert(!isPublicMessageRole("INTERNAL"), "public cannot send INTERNAL");
assert(!isCustomerVisibleRole("INTERNAL"), "INTERNAL not customer-visible");
assert(isCustomerVisibleRole("HUMAN"), "HUMAN still visible");

const publicRoute = read(
  "app/api/public/agents/[publicKey]/conversations/[conversationId]/route.js"
);
assert(/role:\s*\{\s*not:\s*"INTERNAL"\s*\}/.test(publicRoute), "public filters INTERNAL");

const chat = read("lib/services/chat.service.js");
assert(/role:\s*\{\s*not:\s*"INTERNAL"\s*\}/.test(chat), "chat history skips INTERNAL");
assert(/formatDeskNotesForPrompt/.test(chat), "desk notes fed into prompt");
assert(/role:\s*"INTERNAL"/.test(chat), "loads INTERNAL notes separately");

const prompt = read("lib/services/ai/prompt-builder.js");
assert(/formatDeskNotesForPrompt/.test(prompt), "formatDeskNotesForPrompt");
assert(/RESPONSE_RULES_DESK_NOTES/.test(prompt), "desk notes prompt rules");
assert(/deskNotesText/.test(prompt), "buildChatSystemPrompt deskNotesText");

const { formatDeskNotesForPrompt } = await import(
  "../lib/services/ai/prompt-builder.js"
);
const block = formatDeskNotesForPrompt([
  { content: "Promised refund by Friday" },
  { content: "Order ORD-9" },
]);
assert(/Desk internal notes/.test(block), "notes header");
assert(/Promised refund/.test(block) && /ORD-9/.test(block), "note bodies");
assert(formatDeskNotesForPrompt([]) === "", "empty notes");

const handoff = read("lib/services/handoff.service.js");
assert(/sendInternalNote/.test(handoff), "sendInternalNote");
assert(/role !== "INTERNAL"/.test(handoff), "summary skips INTERNAL");

const desk = read("components/desk/DeskThread.jsx");
assert(/sendInternalNote/.test(desk) && /composerMode/.test(desk), "desk note UI");

const bubble = read("components/chat/MessageBubble.jsx");
assert(/INTERNAL/.test(bubble) && /not visible to customer/.test(bubble), "bubble note style");

console.log("ok  F12-U U4 internal notes + feed-to-AI source smoke");
