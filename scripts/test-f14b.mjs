/**
 * F14-B smoke — confirmation evidence fields + owner audit list.
 * Run: npm run test:f14b
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
  const schema = read("prisma/schema.prisma");
  assert(/model ActionConfirmation/.test(schema), "ActionConfirmation model");
  assert(/evidenceId/.test(schema), "evidenceId field");
  assert(/userSubject/.test(schema), "userSubject field");
  assert(/userDisplay/.test(schema), "userDisplay field");
  assert(/decidedAt/.test(schema), "decidedAt field");
  assert(/decidedIp/.test(schema), "decidedIp field");

  assert(
    exists("prisma/migrations/20260827190000_f14b_confirmation_evidence/migration.sql"),
    "F14-B migration"
  );

  const svc = read("lib/services/confirmation.service.js");
  assert(/newEvidenceId|evidenceId/.test(svc), "evidence id stamp");
  assert(/listConfirmationsForAgent/.test(svc), "listConfirmationsForAgent");
  assert(/userDisplay/.test(svc), "userDisplay in service");
  assert(/decidedIp|clientIp/.test(svc), "IP evidence");
  assert(
    /export async function approveConfirmation\(id, conversationId, evidence/.test(
      svc
    ),
    "approve takes evidence"
  );

  const appRoute = read(
    "app/api/conversations/[id]/confirmations/[confirmationId]/route.js"
  );
  assert(/clientIp/.test(appRoute), "app route stamps IP");
  assert(/userSubject/.test(appRoute), "app route subject");

  const pubRoute = read(
    "app/api/public/agents/[publicKey]/confirmations/[confirmationId]/route.js"
  );
  assert(/clientIp/.test(pubRoute), "public route stamps IP");
  assert(/userDisplay/.test(pubRoute), "public route display");

  assert(
    exists("app/api/agents/[id]/confirmations/route.js"),
    "owner GET confirmations"
  );
  const listRoute = read("app/api/agents/[id]/confirmations/route.js");
  assert(/listConfirmationsForAgent/.test(listRoute), "list wired");

  const api = read("lib/api/confirmations.js");
  assert(/listAgentConfirmations/.test(api), "client listAgentConfirmations");

  const form = read("components/customization/ActionsForm.jsx");
  assert(/Consent evidence/.test(form), "owner Consent evidence UI");
  assert(/listAgentConfirmations/.test(form), "form loads confirmations");
  assert(/evidenceId/.test(form), "form shows evidenceId");

  const plan = read("docs/features/F14_END_USER_AUTH_AND_ACTION_CONSENT.md");
  assert(/Phase B/.test(plan) && /✅/.test(plan), "F14 plan marks B done");

  console.log("ok  evidence fields + migration");
  console.log("ok  approve/deny stamp + owner audit API/UI");
  console.log("\nF14-B smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF14-B smoke FAILED:", error.message);
  process.exit(1);
}
