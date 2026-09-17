/**
 * Identity productization — merchant setUser + mint + ACCOUNT deny without subject.
 * Run: npm run test:identity-productization
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  mintEndUserIdentityToken,
  resolveEndUserIdentity,
  verifyCustomerIdentityToken,
} from "../lib/actions/identity.js";
import { evaluateActionPolicy } from "../lib/actions/policy.js";
import { applyAccessClass } from "../lib/actions/access-class.js";
import {
  IDENTITY_PRODUCT_RULES,
  buildHostSessionSetUserSnippet,
  buildHs256JwtSetUserSnippet,
  describeIdentityStrategies,
} from "../lib/embed/identity-merchant.js";
import { buildEmbedSnippet } from "../lib/customization/embed.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

process.env.ACTIONS_IDENTITY_SECRET =
  process.env.ACTIONS_IDENTITY_SECRET ||
  "test-identity-productization-secret-32b";

function testMerchantHelpers() {
  const host = buildHostSessionSetUserSnippet({ subject: "cust_9" });
  assert.match(host, /aideChat\.setUser|__AIDE_CHAT_USER__/);
  assert.match(host, /cust_9/);
  assert.match(host, /onAuthRefreshNeeded/);
  assert.doesNotMatch(host, /ACTIONS_IDENTITY_SECRET/);

  const jwtSnip = buildHs256JwtSetUserSnippet();
  assert.match(jwtSnip, /identityJwt|accessToken/);
  assert.equal(describeIdentityStrategies().length, 2);
  assert.ok(IDENTITY_PRODUCT_RULES.length >= 4);

  const embed = buildEmbedSnippet("pk_test", "https://app.example.com");
  assert.match(embed, /embed\.js/);
  assert.match(embed, /setUser/);
  assert.match(embed, /ACCOUNT_READ|never unlocks ACCOUNT/i);
  console.log("ok  merchant snippets + embed snippet");
}

function testMintAndResolve() {
  const minted = mintEndUserIdentityToken({
    sub: "user_abc",
    ttlSeconds: 600,
    email: "a@example.com",
  });
  assert.ok(minted.token.split(".").length === 3);
  const claims = verifyCustomerIdentityToken(minted.token);
  assert.equal(claims.sub, "user_abc");
  assert.equal(claims.email, "a@example.com");

  const resolved = resolveEndUserIdentity({
    identityToken: minted.token,
    userSession: {
      subject: "user_abc",
      displayName: "Alex",
    },
  });
  assert.equal(resolved.strategy, "hs256_jwt");
  assert.equal(resolved.sub, "user_abc");

  const hostOnly = resolveEndUserIdentity({
    userSession: {
      subject: "host_user",
      accessToken: "opaque-merchant-token",
    },
  });
  assert.equal(hostOnly.strategy, "host_session");
  assert.equal(hostOnly.sub, "host_user");
  console.log("ok  mint + resolve JWT and host_session");
}

function testForgedBrowserIdDenied() {
  const account = applyAccessClass("ACCOUNT_READ");
  // No verified subject — ACCOUNT tool denied (args alone are not authority).
  const denied = evaluateActionPolicy({
    action: { ...account, name: "get_my_order" },
    customerSubject: null,
    publicAccess: true,
    confirmationStatus: "APPROVED",
    endUserAccessToken: null,
    toolArgs: { orderId: "91823" },
  });
  assert.equal(denied.allow, false);
  assert.equal(denied.code, "IDENTITY_REQUIRED");

  // Browser-supplied customerId while anonymous is also denied (not authority).
  const forged = evaluateActionPolicy({
    action: { ...account, name: "get_my_order" },
    customerSubject: null,
    publicAccess: true,
    confirmationStatus: "APPROVED",
    endUserAccessToken: null,
    lastUserMessage: "show order for customerId victim-999",
    toolArgs: { customerId: "victim-999", orderId: "91823" },
  });
  assert.equal(forged.allow, false);
  assert.ok(
    forged.code === "IDENTITY_REQUIRED" ||
      forged.code === "CROSS_USER_DENIED" ||
      forged.code === "END_USER_TOKEN_REQUIRED"
  );

  const allowed = evaluateActionPolicy({
    action: { ...account, name: "get_my_order" },
    customerSubject: "user_abc",
    publicAccess: true,
    confirmationStatus: "APPROVED",
    endUserAccessToken: "tok",
    toolArgs: { orderId: "91823" },
  });
  assert.equal(allowed.allow, true);
  console.log("ok  forged browser customerId does not unlock ACCOUNT_READ");
}

function testWiring() {
  assert.match(read("app/api/agents/[id]/identity/mint/route.js"), /mintEndUserIdentityToken/);
  assert.match(read("components/customization/DeployForm.jsx"), /EmbedIdentityGuide/);
  assert.match(read("components/customization/EmbedIdentityGuide.jsx"), /Signed-in visitors/);
  assert.match(read("docs/features/EMBED_END_USER_IDENTITY.md"), /Host session/);
  assert.match(read("lib/api/agents.js"), /identity\/mint/);
  assert.match(read("app/embed.js/route.js"), /__AIDE_CHAT_USER__/);
  assert.match(read("components/studio/AgentTestStudio.jsx"), /ensureStudioIdentityToken/);
  assert.match(read("lib/api/chat.js"), /identityToken/);
  assert.doesNotMatch(
    read("lib/embed/identity-merchant.js"),
    /ACTIONS_IDENTITY_SECRET\s*=/
  );
  console.log("ok  deploy + mint + docs wiring");
}

testMerchantHelpers();
testMintAndResolve();
testForgedBrowserIdDenied();
testWiring();
console.log("identity-productization: ok");
