/**
 * F14 — public catalog reads run on the embed without Confirm; everything else still confirms.
 * Run: node --test scripts/test-embed-public-read-policy.mjs
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateActionPolicy } from "../lib/actions/policy.js";

const catalog = {
  name: "list_brandly_plans",
  method: "GET",
  riskLevel: "READ",
  accessClass: "PUBLIC_READ",
  identityMode: "OWNER_KEY",
  requiresIdentity: false,
  requiresConfirmation: false,
  urlTemplate: "https://api.example.com/plans",
};
const embed = (action, extra = {}) =>
  evaluateActionPolicy({ action, publicAccess: true, lastUserMessage: "What plans do you offer?", ...extra });

test("explicit PUBLIC_READ GET runs on the embed without Confirm", () => {
  const decision = embed(catalog);
  assert.equal(decision.allow, true);
  assert.equal(decision.needsConfirmation, false);
});

test("still confirms: owner-forced confirm, inferred class, non-GET, WRITE, account-looking name", () => {
  const cases = {
    ownerForcedConfirm: { ...catalog, requiresConfirmation: true },
    inferredClass: { ...catalog, accessClass: undefined },
    guestLookup: { ...catalog, accessClass: "GUEST_LOOKUP" },
    post: { ...catalog, method: "POST" },
    write: { ...catalog, riskLevel: "WRITE" },
  };
  for (const [label, action] of Object.entries(cases)) {
    const decision = embed(action);
    assert.equal(decision.allow, false, label);
    assert.equal(decision.code, "CONFIRMATION_REQUIRED", label);
  }
  for (const name of ["get_my_orders", "lookup_booking", "get_customer_profile", "list_invoices", "order_tracking"]) {
    const decision = embed({ ...catalog, name, urlTemplate: "https://api.example.com/x" });
    assert.equal(decision.allow, false, `${name} keeps Confirm`);
  }
  for (const name of ["list_brandly_plans", "search_brandly_help", "get_store_hours", "get_brandly_campaign_status"]) {
    assert.equal(embed({ ...catalog, name }).allow, true, `${name} is a catalog read`);
  }
});

test("identity tools are unaffected (ACCOUNT_READ still needs proof)", () => {
  const decision = embed({ ...catalog, accessClass: "ACCOUNT_READ", identityMode: "END_USER_TOKEN", requiresIdentity: true });
  assert.equal(decision.allow, false);
  assert.notEqual(decision.code, undefined);
});

test("studio behaviour unchanged for the same tool", () => {
  const decision = evaluateActionPolicy({ action: catalog, publicAccess: false, lastUserMessage: "plans?" });
  assert.equal(decision.allow, true);
});
