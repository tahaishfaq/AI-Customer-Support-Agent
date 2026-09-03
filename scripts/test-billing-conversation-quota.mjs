import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

async function main() {
  const schema = read("prisma/schema.prisma");
  assert(
    schema.includes("maxConversationsPerMonth"),
    "schema must define maxConversationsPerMonth on BillingPlan"
  );

  const constants = read("lib/billing/constants.js");
  assert(constants.includes("maxConversationsPerMonth: 100"), "Free plan quota seed");
  assert(constants.includes("maxConversationsPerMonth: 250"), "Popular plan quota seed");
  assert(constants.includes("maxConversationsPerMonth: 1500"), "Teams plan quota seed");
  assert(constants.includes("maxConversationsPerMonth: 0"), "Custom unlimited seed");

  const usage = read("lib/billing/conversation-usage.service.js");
  assert(usage.includes("HAVING COUNT(*) >= 2"), "Botpress-style 2+ visitor messages");
  assert(usage.includes("conversation_limit_reached"), "quota error code");

  const chat = read("lib/services/chat.service.js");
  assert(chat.includes("assertConversationQuota"), "chat must enforce quota");

  const migration = read(
    "prisma/migrations/20260901190000_b01_conversation_quota/migration.sql"
  );
  assert(migration.includes("maxConversationsPerMonth"), "migration must add column");

  console.log("Conversation quota checks passed.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
