import assert from "node:assert/strict";
import fs from "node:fs";
import {
  REALTIME_EVENT_TYPES,
  REALTIME_VISIBILITIES,
} from "../lib/realtime/constants.js";
import {
  inboxSeenRealtimePayloadSchema,
  isOwnerBusinessEventType,
  parseOwnerBusinessEvent,
  quotaRealtimePayloadSchema,
  subscriptionRealtimePayloadSchema,
} from "../lib/realtime/business-events.js";

const periodStart = "2026-09-01T00:00:00.000Z";
const periodEnd = "2026-10-01T00:00:00.000Z";

assert.equal(isOwnerBusinessEventType(REALTIME_EVENT_TYPES.BILLING_SUBSCRIPTION_UPDATED), true);
assert.equal(isOwnerBusinessEventType(REALTIME_EVENT_TYPES.MESSAGE_CREATED), false);

const subscription = parseOwnerBusinessEvent({
  eventType: REALTIME_EVENT_TYPES.BILLING_SUBSCRIPTION_UPDATED,
  userId: "user-1",
  visibility: REALTIME_VISIBILITIES.OWNER,
  payload: {
    subscriptionId: "subscription-1",
    status: "ACTIVE",
    planId: "plan-1",
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false,
    action: "activated",
    providerEventType: "subscription_payment:complete",
  },
});
assert.equal(subscription.payload.status, "ACTIVE");

const quota = quotaRealtimePayloadSchema.parse({
  periodStart,
  periodEnd,
  unlimited: false,
  used: 2,
  limit: 10,
  remaining: 8,
  planType: "POPULAR",
});
assert.equal(quota.remaining, 8);

const unlimited = quotaRealtimePayloadSchema.parse({
  periodStart,
  periodEnd,
  unlimited: true,
  used: 20,
  limit: null,
  remaining: null,
  planType: "FREE",
});
assert.equal(unlimited.unlimited, true);

const seen = inboxSeenRealtimePayloadSchema.parse({
  workspaceId: "workspace-1",
  seenAt: periodStart,
});
assert.equal(seen.workspaceId, "workspace-1");

assert.throws(() => parseOwnerBusinessEvent({
  eventType: REALTIME_EVENT_TYPES.BILLING_SUBSCRIPTION_UPDATED,
  userId: "user-1",
  visibility: REALTIME_VISIBILITIES.PUBLIC,
  payload: {
    subscriptionId: "subscription-1",
    status: "ACTIVE",
    planId: "plan-1",
  },
}));
assert.throws(() => parseOwnerBusinessEvent({
  eventType: REALTIME_EVENT_TYPES.BILLING_SUBSCRIPTION_UPDATED,
  userId: "user-1",
  visibility: REALTIME_VISIBILITIES.OWNER,
  payload: {
    subscriptionId: "subscription-1",
    status: "ACTIVE",
    planId: "plan-1",
    checkoutReference: "secret-provider-reference",
  },
}));
assert.throws(() => quotaRealtimePayloadSchema.parse({
  periodStart,
  periodEnd,
  unlimited: true,
  used: 2,
  limit: 10,
  remaining: 8,
  planType: "POPULAR",
}));
assert.throws(() => inboxSeenRealtimePayloadSchema.parse({
  workspaceId: "workspace-1",
  seenAt: periodStart,
  userEmail: "private@example.com",
}));

const chatService = fs.readFileSync(new URL("../lib/services/chat.service.js", import.meta.url), "utf8");
assert.match(chatService, /prisma\.\$transaction/);
assert.match(chatService, /REALTIME_EVENT_TYPES\.BILLING_QUOTA_UPDATED/);
assert.match(chatService, /userMessageCount === 2/);
assert.match(chatService, /getQuotaRealtimePayload/);
assert.doesNotMatch(chatService, /checkoutReference.*payload/);

const gateway = fs.readFileSync(new URL("../realtime-gateway/attach.js", import.meta.url), "utf8");
const quotaHook = fs.readFileSync(new URL("../hooks/use-conversation-quota.js", import.meta.url), "utf8");
const queryProvider = fs.readFileSync(new URL("../components/query/QueryProvider.jsx", import.meta.url), "utf8");
assert.match(gateway, /parseOwnerBusinessEvent/);
assert.match(gateway, /isOwnerBusinessEventType/);
assert.match(queryProvider, /BILLING_SUBSCRIPTION_UPDATED/);
assert.match(queryProvider, /BILLING_QUOTA_UPDATED/);
assert.match(quotaHook, /refetchInterval/);
assert.match(quotaHook, /REALTIME_CLIENT_STATUS.CONNECTED/);

console.log("Phase 5.0 billing and owner-event contracts passed");
