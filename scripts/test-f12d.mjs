/**
 * F12 Phases D–G smoke — error handling, perf contracts, scaling config.
 * Run: npm run test:f12d
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
  assert(/Phase D — Error handling ✅/.test(f12), "Phase D marked done");
  assert(/Phase E — Production bottlenecks ✅/.test(f12), "Phase E marked done");
  assert(/Phase F — Scaling ✅/.test(f12), "Phase F marked done");
  assert(/Phase G — Infrastructure ✅/.test(f12), "Phase G marked done");

  const handoff = read("lib/services/handoff.service.js");
  assert(
    handoff.includes("HANDOFF_SUMMARY_FAIL") && handoff.includes("write: true"),
    "summary fail-safe + write 403"
  );
  assert(
    handoff.includes("select:") && handoff.includes("queueWarning"),
    "inbox select + queue warning"
  );

  const chat = read("lib/services/chat.service.js");
  assert(
    chat.includes("CONVERSATION_STATUS.RESOLVED") &&
      chat.includes("CONVERSATION_STATUS.OPEN"),
    "reopen resolved conversations"
  );
  assert(chat.includes("isAiPaused"), "AI gate still present");

  const messages = read("app/api/conversations/[id]/messages/route.js");
  assert(
    messages.includes('role === "ADMIN"'),
    "admin blocked from human replies"
  );

  const publicHandoff = read(
    "app/api/public/agents/[publicKey]/conversations/[conversationId]/handoff/route.js"
  );
  assert(
    publicHandoff.includes("handoffLimitOpts") || publicHandoff.includes("rateLimit"),
    "public handoff rate limit"
  );

  assert(exists("lib/desk/desk-config.js"), "desk config");
  const config = read("lib/desk/desk-config.js");
  assert(config.includes("DESK_WAITING_SOFT_CAP"), "soft cap constant");

  const inbox = read("components/desk/InboxShell.jsx");
  assert(inbox.includes("queueWarning"), "inbox queue warning UI");

  assert(
    handoff.includes("handoffAt: { not: null }"),
    "inbox must scope to desk handoffs"
  );

  const embed = read("components/embed/PublicWebchat.jsx");
  assert(
    embed.includes("handoffEligible") && embed.includes("handoffRemaining"),
    "embed handoff eligibility + limits"
  );
  assert(
    embed.includes("clearActiveEmbedSession"),
    "embed fresh chat on page reload"
  );

  const schema = read("prisma/schema.prisma");
  assert(
    schema.includes("@@index([agentId, status, handoffAt])"),
    "desk inbox index"
  );

  const adminConv = read("app/api/admin/conversations/[id]/route.js");
  assert(adminConv.includes("requireAdmin"), "admin inspect read-only route");

  console.log("ok  F12 D–G contracts");
  console.log("\nF12-D smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF12-D smoke FAILED:", error.message);
  process.exit(1);
}
