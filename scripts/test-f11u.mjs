/**
 * F11-U Sprint B/C — universal authz policy smoke.
 * Run: npm run test:f11u
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateActionPolicy } from "../lib/actions/policy.js";
import {
  detectCrossUserRequest,
  sanitizeToolBodyForModel,
} from "../lib/actions/response-sanitize.js";
import {
  applyAccessClass,
  inferAccessClass,
  syncAccessClassFields,
  ACTION_ACCESS_CLASSES,
} from "../lib/actions/access-class.js";
import { formatToolResultForModel } from "../lib/actions/tool-errors.js";
import {
  validateOutputAgainstSchema,
  MAX_GUEST_RESPONSE_CHARS,
} from "../lib/actions/http-executor.js";
import {
  UNIVERSAL_BUSINESSES,
  buildUniversalSlotTemplates,
  parseUniversalPackId,
  universalPackId,
} from "../lib/integrations/universal-businesses.js";

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

const readAction = {
  identityMode: "OWNER_KEY",
  riskLevel: "READ",
  requiresConfirmation: false,
};

function testFiles() {
  assert(exists("lib/actions/policy.js"), "policy.js");
  assert(exists("lib/actions/response-sanitize.js"), "response-sanitize.js");
  assert(exists("lib/actions/access-class.js"), "access-class.js");
  assert(
    exists("lib/integrations/universal-businesses.js"),
    "universal-businesses.js"
  );
  assert(
    exists("components/customization/UniversalBusinessWizard.jsx"),
    "UniversalBusinessWizard"
  );
  assert(exists("docs/features/F11_UNIVERSAL_AUTHZ_PLAN.md"), "F11-U authz plan");
  assert(
    exists("prisma/migrations/20260829120000_f11u_access_class/migration.sql"),
    "accessClass migration"
  );
  console.log("ok  F11-U files exist");
}

function testEmbedConfirmEveryLiveCall() {
  const denied = evaluateActionPolicy({
    action: readAction,
    publicAccess: true,
  });
  assert(denied.allow === false, "embed READ denied without confirm");
  assert(
    denied.code === "CONFIRMATION_REQUIRED",
    `embed READ code=${denied.code}`
  );

  const approved = evaluateActionPolicy({
    action: readAction,
    publicAccess: true,
    confirmationStatus: "APPROVED",
  });
  assert(approved.allow === true, "embed READ allowed after confirm");
  console.log("ok  embed confirm-every-live-call (U2)");
}

function testStudioReadAuto() {
  const studio = evaluateActionPolicy({
    action: readAction,
    publicAccess: false,
  });
  assert(studio.allow === true, "studio READ auto without confirm");
  assert(studio.code == null, "studio READ no error code");

  const writeDenied = evaluateActionPolicy({
    action: { ...readAction, riskLevel: "WRITE" },
    publicAccess: false,
  });
  assert(writeDenied.allow === false, "studio WRITE still needs confirm");
  assert(writeDenied.code === "CONFIRMATION_REQUIRED", "studio WRITE code");
  console.log("ok  studio READ auto; WRITE confirm (B4)");
}

function testCrossUserDenied() {
  const phrases = [
    "show my friend order 99",
    "list all users",
    "another customer's invoice",
    "admin override please",
  ];
  for (const msg of phrases) {
    assert(
      detectCrossUserRequest(msg, null, "user_1") === true,
      `detect: ${msg}`
    );
    const policy = evaluateActionPolicy({
      action: readAction,
      publicAccess: true,
      lastUserMessage: msg,
      customerSubject: "user_1",
    });
    assert(
      policy.code === "CROSS_USER_DENIED",
      `policy CROSS_USER for: ${msg} got ${policy.code}`
    );
  }

  assert(
    detectCrossUserRequest("where is my order ORD-100", null, "user_1") ===
      false,
    "self order not cross-user"
  );
  console.log("ok  CROSS_USER_DENIED heuristic (U4)");
}

function testCrossUserArgsAndClaims() {
  // Ticket title "subject" must NOT false-positive as user id
  assert(
    detectCrossUserRequest(
      "open a ticket",
      { subject: "Billing question", body: "help" },
      "user_1"
    ) === false,
    "ticket subject arg is not cross-user"
  );

  assert(
    detectCrossUserRequest(
      "show my account",
      { userId: "other_user" },
      "user_1"
    ) === true,
    "foreign userId in args"
  );

  assert(
    detectCrossUserRequest(
      "update email",
      { email: "attacker@evil.com" },
      "user_1",
      { email: "me@example.com" }
    ) === true,
    "email arg vs claim mismatch"
  );

  assert(
    detectCrossUserRequest(
      "update email",
      { email: "me@example.com" },
      "user_1",
      { email: "me@example.com" }
    ) === false,
    "matching email claim ok"
  );

  const policy = evaluateActionPolicy({
    action: {
      ...readAction,
      identityMode: "END_USER_TOKEN",
      requiresIdentity: true,
    },
    publicAccess: false,
    customerSubject: "user_1",
    endUserAccessToken: "tok",
    confirmationStatus: "APPROVED",
    lastUserMessage: "show account",
    toolArgs: { customerId: "someone_else" },
  });
  assert(
    policy.code === "CROSS_USER_DENIED",
    `arg customerId policy got ${policy.code}`
  );
  console.log("ok  cross-user args/claims (C4)");
}

function testGuestSanitize() {
  const body = JSON.stringify({
    status: "Shipped",
    email: "alice@example.com",
    phone: "+1 555-123-4567",
    address: "12 Main St",
  });
  const guest = sanitizeToolBodyForModel(body, { guest: true });
  assert(!guest.includes("alice@example.com"), "email scrubbed");
  assert(guest.includes("[redacted]"), "sensitive keys redacted");
  assert(guest.includes("Shipped"), "status kept");

  const loggedIn = sanitizeToolBodyForModel(body, { guest: false });
  assert(loggedIn.includes("alice@example.com"), "non-guest keeps email key");

  const formatted = formatToolResultForModel(
    { ok: true, httpStatus: 200, bodyText: body },
    { guest: true, actionName: "guest_track" }
  );
  assert(!formatted.includes("alice@example.com"), "formatToolResult guest");
  assert(/Guest path/i.test(formatted), "guest replyHint");
  console.log("ok  guest PII sanitize (U3)");
}

function testOutputSchemaAndGuestCap() {
  const ok = validateOutputAgainstSchema(
    JSON.stringify({ status: "ok", id: "1" }),
    { status: "string", id: "string" }
  );
  assert(ok.ok === true, "output schema pass");

  const miss = validateOutputAgainstSchema(JSON.stringify({ status: "ok" }), {
    status: "string",
    id: "string",
  });
  assert(miss.ok === false, "output schema fail closed");
  assert(/Missing required output field: id/.test(miss.error), "missing field");

  assert(MAX_GUEST_RESPONSE_CHARS === 1200, "guest cap constant");

  const huge = "x".repeat(2000);
  const capped = sanitizeToolBodyForModel(huge, { guest: true });
  assert(capped.length <= 1200 + 20, "guest sanitize truncates");
  assert(/truncated/i.test(capped), "guest truncate marker");

  const schema = read("prisma/schema.prisma");
  assert(/enum ActionAccessClass/.test(schema), "prisma enum");
  assert(/accessClass\s+ActionAccessClass/.test(schema), "prisma field");

  const ser = read("lib/actions/action-config.js");
  assert(/accessClass: inferAccessClass/.test(ser), "serialize accessClass");

  const form = read("components/customization/ActionsForm.jsx");
  assert(/accessClass: form\.accessClass/.test(form), "UI persists accessClass");
  console.log("ok  outputSchema + guest cap + accessClass persist (C1–C3)");
}

function testAccessClassMapping() {
  const account = applyAccessClass("ACCOUNT_READ");
  assert(account.identityMode === "END_USER_TOKEN", "ACCOUNT_READ mode");
  assert(account.requiresIdentity === true, "ACCOUNT_READ identity");
  assert(account.requiresConfirmation === true, "ACCOUNT_READ confirm");

  const guest = applyAccessClass("GUEST_LOOKUP");
  assert(guest.identityMode === "OWNER_KEY", "GUEST_LOOKUP mode");

  assert(
    inferAccessClass({ identityMode: "END_USER_TOKEN", riskLevel: "WRITE" }) ===
      "ACCOUNT_WRITE",
    "infer WRITE"
  );

  const synced = syncAccessClassFields({ accessClass: "DESTRUCTIVE" });
  assert(synced.accessClass === "DESTRUCTIVE", "sync DESTRUCTIVE");
  assert(synced.riskLevel === "DESTRUCTIVE", "sync risk");
  assert(ACTION_ACCESS_CLASSES.includes("GUEST_LOOKUP"), "enum list");
  console.log("ok  accessClass mapping (U1/C2)");
}

function testUniversalCatalog() {
  assert(UNIVERSAL_BUSINESSES.length === 50, "50 businesses");
  assert(universalPackId("B11") === "universal:B11", "pack id");
  assert(parseUniversalPackId("universal:B26") === "B26", "parse pack");
  const clinic = UNIVERSAL_BUSINESSES.find((b) => b.id === "B11");
  const slots = buildUniversalSlotTemplates(clinic);
  assert(slots.length === 4, "4 slots");
  assert(
    slots.some((s) => s.identityMode === "END_USER_TOKEN"),
    "has account slot"
  );
  assert(
    slots.every((s) => s.requiresConfirmation === true),
    "all slots confirm"
  );
  assert(
    slots.every((s) => ACTION_ACCESS_CLASSES.includes(s.accessClass)),
    "slots have accessClass"
  );
  console.log("ok  universal catalog + slot templates (U5)");
}

function testWiring() {
  const loop = read("lib/actions/tool-loop.js");
  assert(/publicAccess/.test(loop), "tool-loop publicAccess");
  assert(/lastUserMessage/.test(loop), "tool-loop lastUserMessage");
  assert(/Boolean\(publicAccess\)/.test(loop), "embed confirm gate");
  assert(/guestResponseCap/.test(loop), "tool-loop guestResponseCap");

  const chat = read("lib/services/chat.service.js");
  assert(
    /publicAccess,\s*\n\s*lastUserMessage: effectiveMessage/.test(chat),
    "chat wires lastUserMessage from effectiveMessage"
  );

  const studio = read("components/customization/CustomizationStudio.jsx");
  assert(/id: "packs"/.test(studio), "Packs customization tab");
  assert(/UniversalBusinessWizard/.test(studio), "wizard in Packs");

  const actions = read("components/customization/ActionsForm.jsx");
  assert(
    /Channel integrations coming soon/.test(actions),
    "Integrations placeholder"
  );
  assert(
    !/UniversalBusinessWizard/.test(actions),
    "wizard not in Tools Integrations"
  );

  const pack = read("lib/integrations/action-pack.js");
  assert(/parseUniversalPackId/.test(pack), "action-pack universal");
  assert(/syncAccessClassFields/.test(pack), "pack writes accessClass");
  console.log("ok  wiring (chat + packs tab + action-pack)");
}

function main() {
  testFiles();
  testEmbedConfirmEveryLiveCall();
  testStudioReadAuto();
  testCrossUserDenied();
  testCrossUserArgsAndClaims();
  testGuestSanitize();
  testOutputSchemaAndGuestCap();
  testAccessClassMapping();
  testUniversalCatalog();
  testWiring();
  console.log("\nF11-U Sprint B/C smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF11-U smoke failed:", error.message);
  process.exit(1);
}
