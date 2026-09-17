/**
 * Task 5 — connection wizard stores credentialId refs only; rotate/revoke; no plaintext.
 * Run: npm run test:connection-wizard
 *
 * Avoid importing credential.service.js (Prisma). Assert serialize contract via source + helpers.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CREDENTIAL_OWNER_FIELDS,
  assertOwnerCredentialSafe,
  buildShopifyAdminConnectPlan,
  credentialPayloadHasPlaintext,
  sanitizeConnectionWriteBody,
} from "../lib/integrations/connection-wizard.js";
import { SHOPIFY_ACCESS_TOKEN_HEADER } from "../lib/integrations/connectors/shopify-admin.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function testSerializeContractInSource() {
  const src = read("lib/services/credential.service.js");
  const match = src.match(
    /export function serializeCredentialForOwner\([\s\S]*?\n\}/
  );
  assert.ok(match, "serializeCredentialForOwner found");
  const fn = match[0];
  assert.match(fn, /hasSecret:\s*Boolean\(cred\.ciphertext\)/);
  assert.doesNotMatch(fn, /^\s*plaintext:/m);
  assert.doesNotMatch(fn, /^\s*ciphertext:/m);
  assert.doesNotMatch(fn, /^\s*secret:/m);
  assert.match(src, /Never return ciphertext, plaintext, or raw secret/);
  console.log("ok  serializeCredentialForOwner contract (no secret fields)");
}

function testOwnerHelpers() {
  const mock = {
    id: "cred_1",
    workspaceId: "ws_1",
    name: "shopify_acme",
    type: "API_KEY_HEADER",
    headerName: SHOPIFY_ACCESS_TOKEN_HEADER,
    keyVersion: 2,
    revokedAt: null,
    lastRotatedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    hasSecret: true,
  };
  assertOwnerCredentialSafe(mock);
  for (const key of Object.keys(mock)) {
    assert.ok(CREDENTIAL_OWNER_FIELDS.includes(key), `field ${key}`);
  }
  assert.equal(credentialPayloadHasPlaintext({ secret: "x" }), true);
  assert.equal(credentialPayloadHasPlaintext({ ciphertext: "v.1" }), true);
  assert.equal(credentialPayloadHasPlaintext(mock), false);
  console.log("ok  owner credential leak helpers");
}

function testSanitizeConnectionBody() {
  const safe = sanitizeConnectionWriteBody({
    name: "shopify_acme",
    baseOrigin: "https://acme.myshopify.com",
    environment: "sandbox",
    credentialId: "cred_1",
    secret: "SHOULD_DROP",
    plaintext: "SHOULD_DROP",
    ciphertext: "SHOULD_DROP",
  });
  assert.equal(safe.credentialId, "cred_1");
  assert.equal(safe.baseOrigin, "https://acme.myshopify.com");
  assert.equal("secret" in safe, false);
  assert.equal("plaintext" in safe, false);
  assert.equal("ciphertext" in safe, false);
  console.log("ok  connection writes drop secret fields");
}

function testShopifyPlan() {
  const plan = buildShopifyAdminConnectPlan({
    shop: "Acme-Store",
    environment: "sandbox",
  });
  assert.equal(plan.connection.baseOrigin, "https://acme-store.myshopify.com");
  assert.equal(plan.credential.type, "API_KEY_HEADER");
  assert.equal(plan.credential.headerName, SHOPIFY_ACCESS_TOKEN_HEADER);
  assert.equal("secret" in plan.credential, false);
  assert.equal("credentialId" in plan.connection, false);
  assert.deepEqual(plan.actionNames, ["shopify_get_order"]);
  console.log("ok  Shopify connect plan is credential-ref shaped");
}

function testUiAndApiWiring() {
  const wizard = read("components/customization/ConnectionWizard.jsx");
  assert.match(wizard, /rotateAgentCredential/);
  assert.match(wizard, /revokeAgentCredential/);
  assert.match(wizard, /credentialId/);
  assert.match(wizard, /Connect Shopify Admin/);
  assert.match(wizard, /credentialPayloadHasPlaintext/);
  assert.match(wizard, /probeAgentConnection/);
  assert.match(wizard, /Test connection/);
  assert.doesNotMatch(wizard, /localStorage\.setItem\([^)]*secret/);

  const form = read("components/customization/ActionsForm.jsx");
  assert.match(form, /ConnectionWizard/);
  assert.match(form, /OpenApiImportPanel/);
  assert.match(form, /McpServersPanel/);

  const credSvc = read("lib/services/credential.service.js");
  assert.match(credSvc, /integrationConnectionRevision\.updateMany/);
  assert.match(credSvc, /rotateCredentialForAgent/);
  assert.match(credSvc, /revokeCredentialForAgent/);

  const connSvc = read("lib/services/connection.service.js");
  assert.match(connSvc, /sanitizeConnectionWriteBody/);

  const credRoute = read(
    "app/api/agents/[id]/credentials/[credentialId]/route.js"
  );
  assert.match(credRoute, /rotateCredentialForAgent/);
  assert.match(credRoute, /revokeCredentialForAgent/);

  const api = read("lib/api/credentials.js");
  assert.match(api, /rotateAgentCredential/);
  assert.match(api, /revokeAgentCredential/);
  console.log("ok  rotate/revoke + wizard wiring");
}

function main() {
  testSerializeContractInSource();
  testOwnerHelpers();
  testSanitizeConnectionBody();
  testShopifyPlan();
  testUiAndApiWiring();
  console.log("\nconnection-wizard smoke passed");
}

main();
