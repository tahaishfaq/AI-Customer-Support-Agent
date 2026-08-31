/**
 * F11 redesign R2 smoke — identity JWT, policy, hashArgs.
 * Run: npm run test:f11r2
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  hashArgs,
  signCustomerIdentityToken,
  verifyCustomerIdentityToken,
} from "../lib/actions/identity.js";
import { evaluateActionPolicy } from "../lib/actions/policy.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function testFiles() {
  assert(exists("lib/actions/identity.js"), "identity.js");
  assert(exists("lib/actions/policy.js"), "policy.js");
  assert(exists("lib/services/confirmation.service.js"), "confirmation.service");
  assert(
    exists("app/api/agents/[id]/credentials/route.js"),
    "credentials route"
  );
  assert(
    exists("app/api/conversations/[id]/confirmations/route.js"),
    "confirmations route"
  );
  console.log("ok  R2 files exist");
}

function testIdentityVerify() {
  process.env.ACTIONS_IDENTITY_SECRET =
    process.env.ACTIONS_IDENTITY_SECRET || "test-identity-secret-32chars-min!!";
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = signCustomerIdentityToken({
    sub: "user_abc",
    iss: "owner-app",
    exp,
  });
  const payload = verifyCustomerIdentityToken(token);
  assert(payload.sub === "user_abc", "sub matches");
  assert(payload.iss === "owner-app", "iss matches");

  let threw = false;
  try {
    verifyCustomerIdentityToken("not.a.jwt");
  } catch {
    threw = true;
  }
  assert(threw, "bad token rejected");
  console.log("ok  identity verify");
}

function testPolicy() {
  const identityDeny = evaluateActionPolicy({
    action: { requiresIdentity: true, riskLevel: "READ" },
    customerSubject: null,
  });
  assert(!identityDeny.allow && identityDeny.code === "IDENTITY_REQUIRED");

  const confirmDeny = evaluateActionPolicy({
    action: {
      requiresIdentity: false,
      requiresConfirmation: true,
      riskLevel: "WRITE",
    },
    customerSubject: "u1",
    confirmationStatus: null,
  });
  assert(!confirmDeny.allow && confirmDeny.code === "CONFIRMATION_REQUIRED");

  const writeRisk = evaluateActionPolicy({
    action: { riskLevel: "WRITE", requiresConfirmation: false },
    confirmationStatus: null,
  });
  assert(!writeRisk.allow && writeRisk.code === "CONFIRMATION_REQUIRED");

  const allowed = evaluateActionPolicy({
    action: { riskLevel: "READ", requiresIdentity: false },
  });
  assert(allowed.allow);

  const approved = evaluateActionPolicy({
    action: { riskLevel: "WRITE", requiresIdentity: true },
    customerSubject: "u1",
    endUserAccessToken: "user-tok",
    confirmationStatus: "APPROVED",
  });
  assert(approved.allow);

  const needToken = evaluateActionPolicy({
    action: { identityMode: "END_USER_TOKEN", riskLevel: "READ" },
    customerSubject: "u1",
    endUserAccessToken: null,
  });
  assert(
    !needToken.allow && needToken.code === "END_USER_TOKEN_REQUIRED",
    "END_USER_TOKEN needs access token"
  );

  const ownerKey = evaluateActionPolicy({
    action: { identityMode: "OWNER_KEY", riskLevel: "READ" },
    customerSubject: null,
  });
  assert(ownerKey.allow, "OWNER_KEY without subject");
  console.log("ok  policy identity+confirm");
}

function testHashArgs() {
  const a = hashArgs({ b: 2, a: 1 });
  const b = hashArgs({ a: 1, b: 2 });
  assert(a === b, "hashArgs stable key order");
  assert(hashArgs({ a: 1 }) !== hashArgs({ a: 2 }), "hashArgs differs");
  console.log("ok  hashArgs stable");
}

function main() {
  testFiles();
  testIdentityVerify();
  testPolicy();
  testHashArgs();
  console.log("\nF11-R2 smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF11-R2 smoke FAILED:", error.message);
  process.exit(1);
}
