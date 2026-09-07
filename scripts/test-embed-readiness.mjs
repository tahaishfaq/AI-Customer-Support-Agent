/**
 * Embed readiness evaluator contract.
 * Run: npm run test:embed-readiness
 */
import assert from "node:assert/strict";
import {
  canSmokeHttpAction,
  evaluateEmbedReadiness,
  httpUrlNeedsOwnerArgs,
  isDemoIntegrationUrl,
} from "../lib/embed/readiness.js";

assert.equal(isDemoIntegrationUrl("https://shop.com/api/demo/orders"), true);
assert.equal(isDemoIntegrationUrl("https://shop.com/api/orders"), false);
assert.equal(httpUrlNeedsOwnerArgs("https://api.shop.com/orders/{{id}}"), true);
assert.equal(httpUrlNeedsOwnerArgs("https://api.shop.com/orders"), false);
assert.equal(
  canSmokeHttpAction({
    enabled: true,
    method: "GET",
    riskLevel: "READ",
    accessClass: "PUBLIC_READ",
  }),
  true
);
assert.equal(
  canSmokeHttpAction({
    enabled: true,
    method: "POST",
    riskLevel: "WRITE",
    accessClass: "ACCOUNT_WRITE",
  }),
  false
);

const pending = evaluateEmbedReadiness({
  liveOrigin: null,
  lastPingAt: null,
  setUserSeen: false,
  embedConversations: 0,
  needsSetUser: true,
  actionsEnabled: true,
  integrations: [],
});
assert.equal(pending.ready, false);
assert.equal(pending.parts.length, 3);
assert.equal(pending.parts[0].id, "site");
assert.equal(pending.parts[1].id, "identity");
assert.equal(pending.parts[2].id, "tools");

const liveNoTools = evaluateEmbedReadiness({
  liveOrigin: "https://shop.example",
  lastPingAt: new Date().toISOString(),
  setUserSeen: false,
  embedConversations: 0,
  needsSetUser: false,
  actionsEnabled: true,
  integrations: [],
});
assert.equal(liveNoTools.ready, true);

const demoOnly = evaluateEmbedReadiness({
  liveOrigin: "https://shop.example",
  lastPingAt: new Date().toISOString(),
  setUserSeen: true,
  embedConversations: 2,
  needsSetUser: true,
  actionsEnabled: true,
  integrations: [
    {
      kind: "http",
      id: "a1",
      name: "Demo orders",
      state: "warn",
      reason: "Demo URL",
      demo: true,
    },
  ],
});
assert.equal(demoOnly.ready, false);
assert.equal(demoOnly.checks.find((c) => c.id === "integrations").state, "warn");

const failedHttp = evaluateEmbedReadiness({
  liveOrigin: "https://shop.example",
  lastPingAt: new Date().toISOString(),
  setUserSeen: true,
  embedConversations: 1,
  needsSetUser: true,
  actionsEnabled: true,
  integrations: [
    {
      kind: "http",
      id: "a1",
      name: "Orders",
      state: "fail",
      reason: "HTTP 500",
      demo: false,
    },
  ],
});
assert.equal(failedHttp.ready, false);
assert.equal(failedHttp.checks.find((c) => c.id === "integrations").state, "fail");

const setUserMiss = evaluateEmbedReadiness({
  liveOrigin: "https://shop.example",
  lastPingAt: new Date().toISOString(),
  setUserSeen: false,
  embedConversations: 3,
  needsSetUser: true,
  actionsEnabled: true,
  integrations: [],
});
assert.equal(setUserMiss.ready, false);
assert.equal(setUserMiss.checks.find((c) => c.id === "set_user").state, "fail");
assert.equal(setUserMiss.parts[1].state, "fail");

const actionsOff = evaluateEmbedReadiness({
  liveOrigin: "https://shop.example",
  lastPingAt: new Date().toISOString(),
  setUserSeen: false,
  embedConversations: 0,
  needsSetUser: false,
  actionsEnabled: false,
  integrations: [
    {
      kind: "http",
      id: "a1",
      name: "Orders",
      state: "fail",
      reason: "HTTP 500",
      demo: false,
    },
  ],
});
assert.equal(actionsOff.ready, true);
assert.equal(actionsOff.parts[2].state, "pass");

console.log("embed-readiness: ok");
