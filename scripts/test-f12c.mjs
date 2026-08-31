/**
 * F12 Phase C smoke — badge, keywords, summary, desk stats.
 * Run: npm run test:f12c
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_HANDOFF_KEYWORDS,
  countHumanRequestMessages,
  matchHandoffKeyword,
  matchHumanRequest,
  parseNeedHumanMarker,
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

function main() {
  const f12 = read("docs/features/F12_HUMAN_DESK.md");
  assert(/Phase C — Improvements ✅/.test(f12), "F12 Phase C marked done");

  assert(exists("app/api/inbox/count/route.js"), "inbox count route");
  assert(exists("app/api/inbox/seen/route.js"), "inbox seen route");
  assert(exists("hooks/use-desk-waiting-count.js"), "waiting count hook");

  const desk = read("lib/desk/conversation-desk.js");
  assert(desk.includes("matchHandoffKeyword"), "keyword matcher");

  const handoff = read("lib/services/handoff.service.js");
  assert(
    handoff.includes("markDeskInboxSeen") &&
      handoff.includes("countWaitingForUser") &&
      handoff.includes("getDeskStatsForUser"),
    "handoff service phase C helpers"
  );

  const chat = read("lib/services/chat.service.js");
  assert(
    chat.includes("matchHumanRequest") &&
      chat.includes("handoffTriggered") &&
      chat.includes("askCount >= 2") &&
      chat.includes("parseNeedHumanMarker"),
    "chat: first human ask tries AI; second insist or NEED_HUMAN can handoff"
  );

  const sidebar = read("components/layout/AppSidebar.jsx");
  assert(
    sidebar.includes("useDeskWaitingCount") && sidebar.includes("badge"),
    "sidebar waiting badge"
  );

  const schema = read("prisma/schema.prisma");
  assert(schema.includes("handoffSummary"), "handoffSummary column");

  assert(
    matchHandoffKeyword("I need to speak to human please")?.phrase ===
      "speak to human",
    "keyword match works"
  );
  assert(!matchHandoffKeyword("hello"), "no false keyword match");
  assert(!matchHumanRequest("Where is my refund dispute going?"), "sensitive topic is not a human-request");
  assert(DEFAULT_HANDOFF_KEYWORDS.length >= 5, "keyword list");
  assert(
    countHumanRequestMessages([
      { role: "USER", content: "hi" },
      { role: "USER", content: "talk to a human" },
    ]) === 1,
    "count human-request turns"
  );
  assert(
    parseNeedHumanMarker("I cannot verify this.\n[[NEED_HUMAN]]").needHuman &&
      !parseNeedHumanMarker("I cannot verify this.\n[[NEED_HUMAN]]").content.includes("NEED_HUMAN"),
    "NEED_HUMAN marker stripped"
  );
  assert(!parseNeedHumanMarker("Hello there").needHuman, "no marker on normal replies");

  console.log("ok  F12-C contracts");
  console.log("\nF12-C smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF12-C smoke FAILED:", error.message);
  process.exit(1);
}
