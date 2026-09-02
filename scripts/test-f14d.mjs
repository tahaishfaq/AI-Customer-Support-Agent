/**
 * F14-D smoke — identity modes + studio Logs tab.
 * Run: npm run test:f14d
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACTION_IDENTITY_MODES,
  resolveIdentityMode,
  syncIdentityFields,
} from "../lib/actions/identity-mode.js";
import { evaluateActionPolicy } from "../lib/actions/policy.js";

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
  assert(ACTION_IDENTITY_MODES.includes("END_USER_TOKEN"), "modes");
  assert(resolveIdentityMode({ requiresIdentity: true }) === "END_USER_TOKEN");
  assert(resolveIdentityMode({ identityMode: "OWNER_KEY" }) === "OWNER_KEY");
  assert(
    syncIdentityFields({ identityMode: "END_USER_TOKEN" }).requiresIdentity ===
      true
  );

  const deny = evaluateActionPolicy({
    action: { identityMode: "END_USER_TOKEN" },
    customerSubject: "u1",
    endUserAccessToken: null,
  });
  assert(deny.code === "END_USER_TOKEN_REQUIRED", "token required");

  const owner = evaluateActionPolicy({
    action: { identityMode: "OWNER_KEY" },
  });
  assert(owner.allow, "owner key ok");

  assert(exists("prisma/migrations/20260827200000_f14d_identity_mode/migration.sql"));
  const schema = read("prisma/schema.prisma");
  assert(/enum ActionIdentityMode/.test(schema), "schema enum");
  assert(/identityMode/.test(schema), "schema field");

  const studio = read("components/studio/AgentTestStudio.jsx");
  assert(/id: "logs"/.test(studio), "Logs mode");
  assert(/StudioActionLogs/.test(studio), "StudioActionLogs wired");

  assert(exists("components/studio/StudioActionLogs.jsx"), "logs component");
  const logs = read("components/studio/StudioActionLogs.jsx");
  assert(/Developer logs/.test(logs), "developer logs copy");
  assert(/listAgentToolRuns/.test(logs), "server runs");

  const dialog = read("components/customization/HttpToolDialog.jsx");
  assert(/END_USER_TOKEN/.test(dialog), "dialog identity mode");

  const loop = read("lib/actions/tool-loop.js");
  assert(/resolveIdentityMode\(fresh\) === "END_USER_TOKEN"/.test(loop), "loop prefer");

  const plan = read("docs/features/F14_END_USER_AUTH_AND_ACTION_CONSENT.md");
  assert(/Phase D/.test(plan) && /✅/.test(plan), "F14 D marked done");

  console.log("ok  identity modes + policy");
  console.log("ok  studio Logs tab + F14-D wiring");
  console.log("\nF14-D smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF14-D smoke FAILED:", error.message);
  process.exit(1);
}
