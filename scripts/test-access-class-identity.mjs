/**
 * Task 2 — accessClass × identityMode contracts for order-style tools.
 * Run: npm run test:access-class-identity
 */
import assert from "node:assert/strict";
import { applyAccessClass } from "../lib/actions/access-class.js";
import {
  resolveIdentityMode,
  requiresCustomerIdentity,
  syncIdentityFields,
} from "../lib/actions/identity-mode.js";
import { evaluateActionPolicy } from "../lib/actions/policy.js";
import { buildUniversalSlotTemplates } from "../lib/integrations/universal-businesses.js";

const guest = applyAccessClass("GUEST_LOOKUP");
const account = applyAccessClass("ACCOUNT_READ");
const write = applyAccessClass("ACCOUNT_WRITE");

assert.equal(guest.identityMode, "OWNER_KEY");
assert.equal(guest.requiresIdentity, false);
assert.equal(account.identityMode, "END_USER_TOKEN");
assert.equal(account.requiresIdentity, true);
assert.equal(write.identityMode, "END_USER_TOKEN");
assert.equal(write.riskLevel, "WRITE");

// accessClass wins over a contradictory identityMode on the row.
assert.equal(
  resolveIdentityMode({
    accessClass: "ACCOUNT_READ",
    identityMode: "NONE",
    requiresIdentity: false,
  }),
  "END_USER_TOKEN"
);
assert.equal(
  requiresCustomerIdentity({
    accessClass: "ACCOUNT_READ",
    identityMode: "NONE",
  }),
  true
);
assert.equal(
  resolveIdentityMode({
    accessClass: "GUEST_LOOKUP",
    identityMode: "END_USER_TOKEN",
  }),
  "OWNER_KEY"
);

const syncedAccount = syncIdentityFields({ accessClass: "ACCOUNT_READ" });
assert.equal(syncedAccount.identityMode, "END_USER_TOKEN");
assert.equal(syncedAccount.requiresIdentity, true);

// ACCOUNT_READ without subject is denied.
const accountNoSubject = evaluateActionPolicy({
  action: { ...account, name: "get_my_order" },
  customerSubject: null,
  publicAccess: true,
  confirmationStatus: "APPROVED",
  endUserAccessToken: "tok",
  toolArgs: { orderId: "91823" },
});
assert.equal(accountNoSubject.allow, false);
assert.equal(accountNoSubject.code, "IDENTITY_REQUIRED");

// Misconfigured ACCOUNT_READ (identityMode NONE) still denied via accessClass.
const misconfigured = evaluateActionPolicy({
  action: {
    accessClass: "ACCOUNT_READ",
    identityMode: "NONE",
    requiresIdentity: false,
    riskLevel: "READ",
    requiresConfirmation: true,
    name: "get_my_order",
  },
  customerSubject: null,
  publicAccess: true,
  confirmationStatus: "APPROVED",
  toolArgs: { orderId: "91823" },
});
assert.equal(misconfigured.allow, false);
assert.ok(
  misconfigured.code === "IDENTITY_REQUIRED" ||
    misconfigured.code === "END_USER_TOKEN_REQUIRED"
);

// ACCOUNT_READ with host_session subject alone is denied on embed (need HS256).
const accountHostOnly = evaluateActionPolicy({
  action: { ...account, name: "get_my_order" },
  customerSubject: "cust-a",
  endUserAccessToken: "opaque-tok",
  publicAccess: true,
  confirmationStatus: "APPROVED",
  identityStrategy: "host_session",
  toolArgs: { orderId: "91823" },
});
assert.equal(accountHostOnly.allow, false);
assert.equal(accountHostOnly.code, "IDENTITY_PROOF_REQUIRED");

// ACCOUNT_READ with HS256 subject but missing end-user token is denied.
const accountNoToken = evaluateActionPolicy({
  action: { ...account, name: "get_my_order" },
  customerSubject: "cust-a",
  endUserAccessToken: null,
  publicAccess: true,
  confirmationStatus: "APPROVED",
  identityStrategy: "hs256_jwt",
  toolArgs: { orderId: "91823" },
});
assert.equal(accountNoToken.allow, false);
assert.equal(accountNoToken.code, "END_USER_TOKEN_REQUIRED");

// ACCOUNT_READ with HS256 + token allowed.
const accountOk = evaluateActionPolicy({
  action: { ...account, name: "get_my_order" },
  customerSubject: "cust-a",
  endUserAccessToken: "tok",
  publicAccess: true,
  confirmationStatus: "APPROVED",
  identityStrategy: "hs256_jwt",
  toolArgs: { orderId: "91823" },
});
assert.equal(accountOk.allow, true);

// GUEST_LOOKUP without subject is not an identity deny (confirm still required on embed).
const guestAnon = evaluateActionPolicy({
  action: { ...guest, name: "guest_order_status" },
  customerSubject: null,
  publicAccess: true,
  confirmationStatus: null,
  toolArgs: { orderId: "91823" },
});
assert.equal(guestAnon.allow, false);
assert.equal(guestAnon.code, "CONFIRMATION_REQUIRED");
assert.notEqual(guestAnon.code, "IDENTITY_REQUIRED");

const guestApproved = evaluateActionPolicy({
  action: { ...guest, name: "guest_order_status" },
  customerSubject: null,
  publicAccess: true,
  confirmationStatus: "APPROVED",
  toolArgs: { orderId: "91823" },
});
assert.equal(guestApproved.allow, true);

// Guest/public cannot pass a forged customerId as authority.
const guestForgedCustomer = evaluateActionPolicy({
  action: { ...guest, name: "guest_order_status" },
  customerSubject: null,
  publicAccess: true,
  confirmationStatus: "APPROVED",
  toolArgs: { orderId: "91823", customerId: "cust-b" },
});
assert.equal(guestForgedCustomer.allow, false);
assert.equal(guestForgedCustomer.code, "CROSS_USER_DENIED");

// Pack slots keep GUEST vs ACCOUNT identity defaults.
const slots = buildUniversalSlotTemplates({
  id: "B01",
  name: "Demo Shop",
  vertical: "Ecommerce",
  guestTools: ["get_order_status"],
  accountTools: ["get_my_orders", "create_support_ticket"],
});
const guestSlot = slots.find((s) => s.accessClass === "GUEST_LOOKUP");
const accountSlot = slots.find((s) => s.accessClass === "ACCOUNT_READ");
assert.ok(guestSlot);
assert.ok(accountSlot);
assert.equal(guestSlot.identityMode, "OWNER_KEY");
assert.equal(guestSlot.requiresIdentity, false);
assert.equal(accountSlot.identityMode, "END_USER_TOKEN");
assert.equal(accountSlot.requiresIdentity, true);
assert.match(String(guestSlot.description), /redacted/i);
assert.match(String(accountSlot.description), /setUser|identity/i);

console.log("access-class-identity: ok");
