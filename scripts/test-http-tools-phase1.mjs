import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function source(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

const guard = await source("lib/services/public-conversation-access.service.js");
assert.match(guard, /x-aide-conversation-access-token/);
assert.match(guard, /PUBLIC_CONVERSATION_ACCESS_REQUIRED/);
assert.match(guard, /PUBLIC_CONVERSATION_ACCESS_INVALID/);

const accessService = await source("lib/realtime/public-access.service.js");
assert.match(
  accessService,
  /customerSubject !== undefined[\s\S]*access\.customerSubjectHash/
);

const protectedRoutes = [
  "app/api/public/agents/[publicKey]/conversations/[conversationId]/route.js",
  "app/api/public/agents/[publicKey]/confirmations/route.js",
  "app/api/public/agents/[publicKey]/confirmations/[confirmationId]/route.js",
  "app/api/public/agents/[publicKey]/conversations/[conversationId]/handoff/route.js",
  "app/api/public/agents/[publicKey]/conversations/[conversationId]/csat/route.js",
  "app/api/public/agents/[publicKey]/feedback/route.js",
];

for (const route of protectedRoutes) {
  const text = await source(route);
  assert.match(text, /requirePublicConversationAccess/,
    `${route} must enforce public conversation access`);
  assert.match(text, /originFromRequest\(request\)/,
    `${route} must preserve origin binding`);
}

const confirmationRoute = await source(
  "app/api/public/agents/[publicKey]/confirmations/[confirmationId]/route.js"
);
assert.doesNotMatch(
  confirmationRoute,
  /userSubject:\s*body\?\.userSubject/,
  "confirmation identity must not come from request body"
);
assert.match(confirmationRoute, /userSubject:\s*conversation\.customerSubject/);

const feedbackRoute = await source("app/api/public/agents/[publicKey]/feedback/route.js");
assert.match(feedbackRoute, /message\.conversationId/);
assert.match(feedbackRoute, /message\.conversation\.agentId/);

const client = await source("components/embed/PublicWebchat.jsx");
const clientHeaderCount = (client.match(/x-aide-conversation-access-token/g) || []).length;
assert.ok(clientHeaderCount >= 5, "embed mutations and history reads must forward access token");

const confirmationsApi = await source("lib/api/confirmations.js");
assert.match(confirmationsApi, /realtimeAccessToken/);
assert.match(confirmationsApi, /x-aide-conversation-access-token/);

console.log("HTTP tools Phase 1 contract checks passed");
