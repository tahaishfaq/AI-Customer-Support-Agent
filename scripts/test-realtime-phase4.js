import assert from "node:assert/strict";
import {
  REALTIME_EVENT_TYPES,
  REALTIME_ROOMS,
} from "../lib/realtime/constants.js";
import {
  ephemeralRooms,
  isEphemeralEventType,
  parseEphemeralEvent,
} from "../lib/realtime/ephemeral.js";
import {
  createSlidingWindowRateLimiter,
  createTypingLeaseManager,
} from "../realtime-gateway/ephemeral-runtime.js";

const future = new Date(Date.now() + 30_000).toISOString();

assert.equal(isEphemeralEventType(REALTIME_EVENT_TYPES.TYPING_STARTED), true);
assert.equal(isEphemeralEventType(REALTIME_EVENT_TYPES.MESSAGE_CREATED), false);

const ownerTyping = parseEphemeralEvent({
  eventType: REALTIME_EVENT_TYPES.TYPING_STARTED,
  payload: {
    conversationId: "conversation-1",
    actorType: "OWNER",
    actorId: "user-1",
    expiresAt: future,
  },
});
assert.equal(ownerTyping.payload.actorType, "OWNER");
assert.deepEqual(ephemeralRooms(ownerTyping), [
  REALTIME_ROOMS.conversationOwner("conversation-1"),
  REALTIME_ROOMS.conversationPublic("conversation-1"),
]);

const stoppedTyping = parseEphemeralEvent({
  eventType: REALTIME_EVENT_TYPES.TYPING_STOPPED,
  payload: {
    conversationId: "conversation-1",
    actorType: "PUBLIC",
    actorId: "customer-1",
    expiresAt: null,
  },
});
assert.equal(stoppedTyping.payload.actorType, "PUBLIC");

const presence = parseEphemeralEvent({
  eventType: REALTIME_EVENT_TYPES.PRESENCE_UPDATED,
  payload: {
    workspaceId: "workspace-1",
    userId: "user-1",
    displayName: "Samia",
    actorType: "OWNER",
    status: "online",
    conversationId: "conversation-1",
  },
});
assert.deepEqual(ephemeralRooms(presence), [
  REALTIME_ROOMS.workspaceDesk("workspace-1"),
  REALTIME_ROOMS.conversationOwner("conversation-1"),
]);

const viewing = parseEphemeralEvent({
  eventType: REALTIME_EVENT_TYPES.VIEWING_STARTED,
  payload: {
    workspaceId: "workspace-1",
    conversationId: "conversation-1",
    userId: "user-1",
    actorType: "OWNER",
  },
});
assert.deepEqual(ephemeralRooms(viewing), [REALTIME_ROOMS.conversationOwner("conversation-1")]);

assert.throws(() => parseEphemeralEvent({
  eventType: REALTIME_EVENT_TYPES.TYPING_STARTED,
  payload: {
    conversationId: "conversation-1",
    actorType: "OWNER",
    expiresAt: "2000-01-01T00:00:00.000Z",
  },
}));
assert.throws(() => parseEphemeralEvent({
  eventType: REALTIME_EVENT_TYPES.TYPING_STARTED,
  payload: { conversationId: "conversation-1", actorType: "CUSTOMER", expiresAt: future },
}));
assert.throws(() => parseEphemeralEvent({
  eventType: REALTIME_EVENT_TYPES.PRESENCE_UPDATED,
  payload: {
    workspaceId: "workspace-1",
    userId: "user-1",
    displayName: "Samia",
    actorType: "OWNER",
    status: "online",
    extra: "not allowed",
  },
}));
assert.throws(() => parseEphemeralEvent({
  eventType: REALTIME_EVENT_TYPES.VIEWING_STARTED,
  payload: {
    workspaceId: "workspace-1",
    conversationId: "conversation-1",
    userId: "user-1",
    actorType: "PUBLIC",
  },
}));
assert.throws(() => parseEphemeralEvent({ eventType: "conversation.message.created", payload: {} }));

let clock = 1_000;
const limiter = createSlidingWindowRateLimiter({ max: 2, windowMs: 1_000, now: () => clock });
assert.equal(limiter.consume("socket"), true);
assert.equal(limiter.consume("socket"), true);
assert.equal(limiter.consume("socket"), false);
clock += 1_001;
assert.equal(limiter.consume("socket"), true);
limiter.clear();

const expired = [];
const leases = createTypingLeaseManager({
  ttlMs: 1_000,
  debounceMs: 350,
  now: () => clock,
});
assert.equal(leases.start("OWNER:conversation-1", () => expired.push("conversation-1")).shouldEmit, true);
assert.equal(leases.start("OWNER:conversation-1", () => expired.push("conversation-1")).shouldEmit, false);
assert.equal(leases.stop("OWNER:conversation-1"), true);
assert.equal(expired.length, 0);
leases.clear((key) => expired.push(key));

console.log("Phase 4.1 realtime contracts and ephemeral runtime passed");
