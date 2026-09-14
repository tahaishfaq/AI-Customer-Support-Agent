import assert from "node:assert/strict";

process.env.REALTIME_TOKEN_SECRET = "phase1-test-secret";
process.env.REALTIME_TOKEN_ISSUER = "aide-test";
process.env.REALTIME_TOKEN_AUDIENCE = "aide-test-client";

const [tokens, acl, constants, events] = await Promise.all([
  import("../lib/realtime/tokens.js"),
  import("../lib/realtime/acl.js"),
  import("../lib/realtime/constants.js"),
  import("../lib/realtime/events.js"),
]);

const ownerToken = await tokens.signOwnerRealtimeToken({
  userId: "user-1",
  realtimeSessionId: "session-a",
  role: "USER",
  workspaceIds: ["workspace-1"],
});
const ownerClaims = await tokens.verifyRealtimeToken(ownerToken, {
  expectedType: "aide-realtime-owner",
});

assert.equal(ownerClaims.sub, "user-1");
assert.equal(acl.authorizeRoom(ownerClaims, constants.REALTIME_ROOMS.user("user-1")), true);
assert.equal(
  acl.authorizeRoom(ownerClaims, constants.REALTIME_ROOMS.workspaceDesk("workspace-1")),
  true
);
assert.equal(
  acl.authorizeRoom(ownerClaims, constants.REALTIME_ROOMS.workspaceDesk("workspace-2")),
  false
);
assert.equal(acl.authorizeRoom(ownerClaims, constants.REALTIME_ROOMS.user("user-2")), false);

const publicToken = await tokens.signPublicRealtimeToken({
  conversationId: "conversation-1",
  agentId: "agent-1",
  publicKeyId: "public-key-1",
  realtimeSessionId: "public-session-1",
});
const publicClaims = await tokens.verifyRealtimeToken(publicToken, {
  expectedType: "aide-realtime-public-conversation",
});
assert.equal(
  acl.authorizeRoom(publicClaims, constants.REALTIME_ROOMS.conversationPublic("conversation-1")),
  true
);
assert.equal(
  acl.authorizeRoom(publicClaims, constants.REALTIME_ROOMS.conversationPublic("conversation-2")),
  false
);
assert.equal(acl.authorizeRoom(publicClaims, constants.REALTIME_ROOMS.user("user-1")), false);

const event = events.buildRealtimeEvent({
  eventType: "conversation.message.created",
  aggregateType: "conversation",
  aggregateVersion: 1,
  visibility: "BOTH",
  conversationId: "conversation-1",
  payload: { messageId: "message-1", role: "USER", content: "safe" },
});
assert.equal(event.schemaVersion, 1);
assert.equal(event.payload.messageId, "message-1");

await assert.rejects(
  () => tokens.verifyRealtimeToken(publicToken, { expectedType: "aide-realtime-owner" }),
  /Realtime token type is not allowed/
);

console.log("Realtime Phase 1 contract and ACL checks passed.");
