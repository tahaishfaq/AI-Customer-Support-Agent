import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const plan = read("docs/features/SOCKET_REALTIME_PLAN.md");
const provider = read("components/realtime/RealtimeProvider.jsx");
const queryProvider = read("components/query/QueryProvider.jsx");
const quota = read("hooks/use-conversation-quota.js");
const badge = read("hooks/use-desk-waiting-count.js");
const inbox = read("components/desk/InboxShell.jsx");
const thread = read("components/desk/DeskThread.jsx");
const tokenRoute = read("app/api/realtime/token/route.js");
const gateway = read("realtime-gateway/attach.js");
const sessionCheck = read("realtime-gateway/session-check.js");

assert.match(plan, /Redis as the realtime delivery bus/);
assert.match(plan, /billing-success confirmation loop/);
assert.match(plan, /restore polling when disconnected/);
assert.match(provider, /io\(socketUrl/);
assert.match(provider, /workspace:\$\{workspaceId\}:desk/);
assert.match(provider, /room:join/);
assert.match(provider, /reconciled: true/);
assert.match(provider, /seenEventIdsRef/);
assert.match(provider, /event\.eventId/);
assert.match(queryProvider, /BILLING_SUBSCRIPTION_UPDATED/);
assert.match(queryProvider, /HANDOFF_CREATED/);
assert.match(queryProvider, /invalidateQueries/);
assert.match(quota, /useQuery/);
assert.match(quota, /refetchInterval/);
assert.match(badge, /useQuery/);
assert.match(badge, /DESK_NAV_BADGE_POLL_MS/);
assert.match(queryProvider, /invalidateDeskQueries/);
assert.match(inbox, /LIST_POLL_MS/);
assert.match(inbox, /queryKeys\.desk\.inbox/);
assert.match(thread, /incoming\?\.conversationId !== conversation\.id/);
assert.match(thread, /realtimeConnected/);
assert.match(thread, /refreshRequestRef/);
assert.match(thread, /if \(realtimeConnected\) return undefined/);
assert.match(tokenRoute, /realtimeUrl: config\.url/);
assert.match(tokenRoute, /config\.billingEnabled/);
assert.match(gateway, /assertOwnerConversationAccess/);
assert.match(gateway, /conversation:\(\[\^:\]\+\):owner/);
assert.match(sessionCheck, /JOIN "Agent" a/);

console.log("Realtime Phase 2 client contract checks passed.");
