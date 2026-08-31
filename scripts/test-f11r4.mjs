/**
 * F11 redesign R4 smoke — multi-vertical templates + serialize riskLevel.
 * Run: npm run test:f11r4
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACTION_TEMPLATES,
  serializeActionForOwner,
} from "../lib/actions/action-config.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function testTemplates() {
  const ids = ACTION_TEMPLATES.map((t) => t.id);
  assert(ids.includes("get_appointment"), "booking template");
  assert(ids.includes("create_support_ticket"), "ticket template");
  assert(ids.includes("get_subscription"), "subscription template");
  assert(ids.includes("demo_order_status"), "demo order kept");

  const ticket = ACTION_TEMPLATES.find((t) => t.id === "create_support_ticket");
  assert(ticket.riskLevel === "WRITE", "ticket WRITE");
  assert(ticket.requiresConfirmation === true, "ticket confirm");
  console.log("ok  ACTION_TEMPLATES booking/ticket/subscription");
}

function testSerialize() {
  const s = serializeActionForOwner({
    id: "x",
    agentId: "a1",
    name: "get_appointment",
    description: "Lookup",
    method: "GET",
    urlTemplate: "https://api.example.com/appointments/{{id}}",
    headersJson: {},
    enabled: true,
    timeoutMs: 8000,
    riskLevel: "READ",
    requiresIdentity: true,
    requiresConfirmation: false,
    credentialId: "cred1",
    version: 2,
  });
  assert(s.riskLevel === "READ", "serialize riskLevel");
  assert(s.requiresIdentity === true, "serialize requiresIdentity");
  assert(s.credentialId === "cred1", "serialize credentialId");
  assert(s.version === 2, "serialize version");
  console.log("ok  serialize includes riskLevel");
}

function testUi() {
  assert(exists("components/customization/ActionsForm.jsx"));
  const form = fs.readFileSync(
    path.join(root, "components/customization/ActionsForm.jsx"),
    "utf8"
  );
  assert(/credentialId|Create credential/.test(form), "ActionsForm credentials");
  assert(/requiresIdentity|Risk level/.test(form), "ActionsForm risk/identity");
  assert(exists("lib/api/credentials.js"), "credentials client api");
  console.log("ok  ActionsForm + credentials api");
}

function main() {
  testTemplates();
  testSerialize();
  testUi();
  console.log("\nF11-R4 smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF11-R4 smoke FAILED:", error.message);
  process.exit(1);
}
