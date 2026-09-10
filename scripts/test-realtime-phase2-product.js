import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const handoff = read("lib/services/handoff.service.js");
const chat = read("lib/services/chat.service.js");
const billing = read("lib/billing/activate-paid-subscription.js");
const webhook = read("lib/billing/webhook.service.js");
const constants = read("lib/realtime/constants.js");

const requiredConversationFlows = [
  "HANDOFF_CREATED",
  "MESSAGE_CREATED",
  "CLAIM_UPDATED",
  "STATUS_UPDATED",
  "PRIORITY_UPDATED",
  "CSAT_UPDATED",
];

for (const eventType of requiredConversationFlows) {
  assert.match(constants, new RegExp(`${eventType}:`));
  assert.match(handoff, new RegExp(`REALTIME_EVENT_TYPES\\.${eventType}`));
}

assert.match(chat, /persistChatMessageWithEvent/);
assert.match(chat, /enqueueRealtimeEvent\(tx/);
assert.match(chat, /REALTIME_EVENT_TYPES\.MESSAGE_CREATED/);
assert.match(billing, /prisma\.\$transaction/);
assert.match(billing, /enqueueRealtimeEvent\(tx/);
assert.match(webhook, /activatePaidSubscription/);
assert.match(webhook, /REALTIME_EVENT_TYPES\.BILLING_SUBSCRIPTION_UPDATED/);

const internalNoteStart = handoff.indexOf("export async function sendInternalNote");
const internalNoteEnd = handoff.indexOf("export async function", internalNoteStart + 10);
const internalNote = handoff.slice(internalNoteStart, internalNoteEnd === -1 ? undefined : internalNoteEnd);
assert.match(internalNote, /visibility: REALTIME_VISIBILITIES\.OWNER/);
assert.doesNotMatch(internalNote, /visibility: REALTIME_VISIBILITIES\.BOTH/);

for (const source of [handoff, chat, billing]) {
  assert.match(source, /realtimeVersion: \{ increment: 1 \}/);
  assert.match(source, /enqueueRealtimeEvent\(tx/);
}

console.log("Realtime Phase 2 product-flow transaction contracts passed.");
