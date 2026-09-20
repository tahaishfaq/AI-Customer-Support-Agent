/**
 * Phase 0 contract checks — pack defaults, policy backstop, Shopify ownership,
 * publish gate, public access rebind helpers (pure / no DB).
 *
 * Run: npm run test:phase0-security
 */
import assert from "node:assert/strict";

import {
  ACTION_TEMPLATES,
} from "../lib/actions/action-config.js";
import {
  assertAccountToolPublishSafe,
  syncAccessClassFields,
  ACCOUNT_RESOURCE_TOOL_NAME_RE,
} from "../lib/actions/access-class.js";
import {
  evaluateActionPolicy,
  ACCOUNT_TOOL_MISCONFIGURED,
  IDENTITY_PROOF_REQUIRED,
} from "../lib/actions/policy.js";
import {
  assertShopifyOrderBelongsToCustomer,
} from "../lib/integrations/connectors/shopify-admin.js";
import { evaluateEmbedReadiness } from "../lib/embed/readiness.js";

import {
  assembleAgentTurnTrace,
} from "../lib/services/agent-trace-format.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function pass(name) {
  console.log(`PASS ${name}`);
}

function templateById(id) {
  return ACTION_TEMPLATES.find((t) => t.id === id);
}

// --- Task 1 templates ---
{
  const shopify = templateById("shopify_get_order");
  assert.equal(shopify.accessClass, "ACCOUNT_READ");
  assert.equal(shopify.identityMode, "END_USER_TOKEN");
  assert.equal(shopify.requiresIdentity, true);

  const siteOrder = templateById("site_order_status");
  assert.equal(siteOrder.accessClass, "ACCOUNT_READ");

  const demo = templateById("demo_order_status");
  assert.equal(demo.accessClass, "PUBLIC_READ");
  assert.match(demo.urlTemplate, /\/api\/demo\//);

  const synced = syncAccessClassFields(shopify);
  assert.equal(synced.accessClass, "ACCOUNT_READ");
  assert.equal(synced.identityMode, "END_USER_TOKEN");

  const badPublish = assertAccountToolPublishSafe({
    name: "shopify_get_order",
    accessClass: "PUBLIC_READ",
    identityMode: "NONE",
    urlTemplate: "https://mystore.myshopify.com/admin/api/2024-10/orders/{{orderId}}.json",
    enabled: true,
  });
  assert.equal(badPublish.ok, false);
  assert.equal(badPublish.code, "ACCOUNT_TOOL_MISCONFIGURED");

  const goodPublish = assertAccountToolPublishSafe({
    name: "shopify_get_order",
    accessClass: "ACCOUNT_READ",
    identityMode: "END_USER_TOKEN",
    requiresIdentity: true,
    enabled: true,
  });
  assert.equal(goodPublish.ok, true);
  pass("templates + publish gate");
}

// --- Task 2 policy ---
{
  const denied = evaluateActionPolicy({
    action: {
      name: "shopify_get_order",
      accessClass: "PUBLIC_READ",
      identityMode: "NONE",
      urlTemplate: "https://shop.myshopify.com/admin/api/2024-10/orders/{{orderId}}.json",
      riskLevel: "READ",
    },
    publicAccess: true,
    identityStrategy: null,
  });
  assert.equal(denied.allow, false);
  assert.equal(denied.code, ACCOUNT_TOOL_MISCONFIGURED);

  const accountNeedsJwt = evaluateActionPolicy({
    action: {
      name: "shopify_get_order",
      accessClass: "ACCOUNT_READ",
      identityMode: "END_USER_TOKEN",
      requiresIdentity: true,
      riskLevel: "READ",
      requiresConfirmation: true,
    },
    publicAccess: true,
    customerSubject: "cust_1",
    endUserAccessToken: "opaque-token",
    identityStrategy: "host_session",
  });
  assert.equal(accountNeedsJwt.allow, false);
  assert.equal(accountNeedsJwt.code, IDENTITY_PROOF_REQUIRED);

  const forgedSubject = evaluateActionPolicy({
    action: {
      name: "get_subscription",
      accessClass: "ACCOUNT_READ",
      identityMode: "END_USER_TOKEN",
      requiresIdentity: true,
      riskLevel: "READ",
    },
    publicAccess: true,
    customerSubject: null,
    identityStrategy: null,
  });
  assert.equal(forgedSubject.allow, false);

  const destructive = evaluateActionPolicy({
    action: {
      name: "cancel_order",
      accessClass: "DESTRUCTIVE",
      identityMode: "END_USER_TOKEN",
      requiresIdentity: true,
      riskLevel: "DESTRUCTIVE",
      requiresConfirmation: true,
    },
    publicAccess: true,
    customerSubject: "cust_1",
    endUserAccessToken: "tok",
    identityStrategy: "hs256_jwt",
    confirmationStatus: null,
  });
  assert.equal(destructive.allow, false);
  assert.equal(destructive.code, "CONFIRMATION_REQUIRED");
  pass("policy backstop + identity + confirm");
}

assert.equal(ACCOUNT_RESOURCE_TOOL_NAME_RE.test("shopify_get_order"), true);

// --- Task 5 Shopify ownership ---
{
  const body = JSON.stringify({
    order: {
      id: 91823,
      email: "buyer@example.com",
      customer: { id: 55, email: "buyer@example.com" },
      line_items: [],
    },
  });
  const ok = assertShopifyOrderBelongsToCustomer(body, {
    customerClaims: { email: "buyer@example.com" },
  });
  assert.equal(ok.ok, true);

  const denied = assertShopifyOrderBelongsToCustomer(body, {
    customerClaims: { email: "other@example.com" },
    customerSubject: "99",
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, "ORDER_OWNERSHIP_DENIED");
  pass("shopify order ownership");
}

// --- Task 8 readiness ---
{
  const red = evaluateEmbedReadiness({
    liveOrigin: "https://shop.example",
    lastPingAt: new Date().toISOString(),
    setUserSeen: true,
    embedConversations: 1,
    needsSetUser: true,
    unsafeAccountTools: 2,
    actionsEnabled: true,
    integrations: [],
  });
  assert.equal(red.ready, false);
  assert.ok(red.checks.some((c) => c.id === "account_tools" && c.state === "fail"));

  const green = evaluateEmbedReadiness({
    liveOrigin: "https://shop.example",
    lastPingAt: new Date().toISOString(),
    setUserSeen: true,
    embedConversations: 1,
    needsSetUser: true,
    unsafeAccountTools: 0,
    actionsEnabled: true,
    integrations: [],
  });
  assert.equal(green.ready, true);
  pass("embed readiness account_tools gate");
}

// --- Task 9 trace policy visibility ---
{
  const trace = assembleAgentTurnTrace({
    turn: {
      id: "t1",
      agentId: "a1",
      conversationId: "c1",
      status: "COMPLETED",
      ownershipVersion: 0,
      startedAt: new Date(),
      lastHeartbeatAt: new Date(),
      createdAt: new Date(),
    },
    toolRuns: [
      {
        id: "tr1",
        status: "ERROR",
        errorCode: "IDENTITY_PROOF_REQUIRED",
        action: { name: "shopify_get_order" },
        createdAt: new Date(),
      },
      {
        id: "tr2",
        status: "ERROR",
        errorCode: "CONFIRMATION_REQUIRED",
        action: { name: "cancel_order" },
        createdAt: new Date(),
      },
    ],
    messages: [],
  });
  assert.equal(trace.toolRuns[0].policyOutcome, "IDENTITY_PROOF_REQUIRED");
  assert.equal(trace.toolRuns[1].confirmationRequired, true);
  pass("agent trace policy outcomes");
}

// --- Task 3 rebind: source contains prior-access gate ---
{
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const chatSrc = fs.readFileSync(
    path.join(root, "lib/services/chat.service.js"),
    "utf8"
  );
  assert.match(chatSrc, /priorAccess/);
  assert.match(chatSrc, /never silently re-mint/);
  assert.match(chatSrc, /PUBLIC_CONVERSATION_ACCESS_REQUIRED/);
  pass("public conversation rebind source gate");
}

console.log("\nAll Phase 0 security contracts passed.");
