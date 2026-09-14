import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const provider = read("components/query/QueryProvider.jsx");
const quota = read("hooks/use-conversation-quota.js");
const badge = read("hooks/use-desk-waiting-count.js");
const inbox = read("components/desk/InboxShell.jsx");
const thread = read("components/desk/DeskThread.jsx");
const constants = read("lib/realtime/constants.js");

for (const event of [
  "MESSAGE_CREATED",
  "CLAIM_UPDATED",
  "STATUS_UPDATED",
  "PRIORITY_UPDATED",
  "INBOX_SEEN_UPDATED",
]) {
  assert.match(provider, new RegExp(`REALTIME_EVENT_TYPES\\.${event}`));
  assert.match(constants, new RegExp(`${event}:`));
}
assert.match(provider, /invalidateDeskQueries\(queryClient/);
assert.match(provider, /BILLING_SUBSCRIPTION_UPDATED/);
assert.match(provider, /BILLING_QUOTA_UPDATED/);
assert.match(quota, /realtimeConnected \? false/);
assert.match(badge, /realtimeConnected \? false/);
assert.match(inbox, /realtimeConnected \? false/);
assert.match(thread, /if \(realtimeConnected\) return undefined/);

console.log("TanStack Query Q4 socket alignment contracts passed");
