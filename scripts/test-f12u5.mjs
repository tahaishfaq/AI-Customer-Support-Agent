/**
 * F12-U U5 — CSAT after resolve (source smoke).
 * Run: node scripts/test-f12u5.mjs
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

const files = [
  "prisma/migrations/20260830010000_f12u_csat/migration.sql",
  "app/api/public/agents/[publicKey]/conversations/[conversationId]/csat/route.js",
  "components/chat/CsatPrompt.jsx",
];

for (const rel of files) {
  assert(exists(rel), `missing ${rel}`);
}

const schema = read("prisma/schema.prisma");
assert(/csatScore/.test(schema) && /csatAt/.test(schema), "schema csat fields");

const desk = read("lib/desk/conversation-desk.js");
assert(/isCsatPending/.test(desk) && /csatPending/.test(desk), "csatPending in desk serialize");

const handoff = read("lib/services/handoff.service.js");
assert(/setConversationCsat/.test(handoff), "setConversationCsat export");
assert(/csatScore:\s*null/.test(handoff) && /csatAt:\s*null/.test(handoff), "clear CSAT on new handoff");

const embed = read("components/embed/PublicWebchat.jsx");
assert(/CsatPrompt/.test(embed) && /submitCsat/.test(embed), "embed CSAT UI");

const validation = read("lib/validations/desk.js");
assert(/deskCsatBodySchema/.test(validation), "deskCsatBodySchema");

console.log("ok  F12-U U5 CSAT source smoke");
