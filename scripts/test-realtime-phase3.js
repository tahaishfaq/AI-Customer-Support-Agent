import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const hook = read("hooks/use-public-realtime.js");
const widget = read("components/embed/PublicWebchat.jsx");
const deskHook = read("hooks/use-embed-desk.js");
const tokenRoute = read(
  "app/api/public/agents/[publicKey]/conversations/[conversationId]/realtime-token/route.js"
);
const gateway = read("realtime-gateway/attach.js");
const sessionCheck = read("realtime-gateway/session-check.js");
const publicAccess = read("lib/realtime/public-access.service.js");
const chat = read("lib/services/chat.service.js");
const handoff = read("lib/services/handoff.service.js");

assert.match(hook, /conversation:\$\{conversationId\}:public/);
assert.match(hook, /room:join/);
assert.match(hook, /realtime-token/);
assert.match(hook, /seenEventIds/);
assert.match(hook, /socket\.auth/);
assert.match(widget, /usePublicRealtime/);
assert.match(widget, /realtimeAccessToken/);
assert.match(widget, /publicRealtimeConnected/);
assert.match(widget, /playNotificationBeep/);
assert.match(widget, /data-realtime-status/);
assert.match(deskHook, /realtimeConnected/);
assert.match(tokenRoute, /issuePublicRealtimeToken/);
assert.match(tokenRoute, /realtimeUrl/);
assert.match(tokenRoute, /accessToken/);
assert.match(gateway, /assertPublicConversationAccess/);
assert.match(gateway, /aide-realtime-public-conversation/);
assert.match(sessionCheck, /assertPublicConversationAccess/);
assert.match(sessionCheck, /revokedAt/);
assert.match(publicAccess, /customerSubjectHash/);
assert.match(publicAccess, /originHash/);
assert.match(widget, /status === "connected"/);
assert.match(widget, /refreshConversation\(\)/);
assert.match(chat, /REALTIME_VISIBILITIES\.BOTH/);
assert.match(handoff, /HANDOFF_CREATED/);
assert.match(handoff, /visibility: REALTIME_VISIBILITIES\.BOTH/);
assert.match(handoff, /MESSAGE_CREATED/);

console.log("Realtime Phase 3 public embed contract checks passed.");
