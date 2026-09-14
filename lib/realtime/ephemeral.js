import { z } from "zod";
import {
  REALTIME_EVENT_TYPES,
  REALTIME_ROOMS,
} from "./constants.js";

export const REALTIME_EPHEMERAL_EVENT_TYPES = Object.freeze([
  REALTIME_EVENT_TYPES.TYPING_STARTED,
  REALTIME_EVENT_TYPES.TYPING_STOPPED,
  REALTIME_EVENT_TYPES.PRESENCE_UPDATED,
  REALTIME_EVENT_TYPES.VIEWING_STARTED,
  REALTIME_EVENT_TYPES.VIEWING_STOPPED,
]);

export const TYPING_ACTOR_TYPES = Object.freeze({
  OWNER: "OWNER",
  PUBLIC: "PUBLIC",
});

export const PRESENCE_STATUSES = Object.freeze({
  ONLINE: "online",
  AWAY: "away",
  OFFLINE: "offline",
});

const optionalNullableId = z.string().trim().min(1).max(200).nullable().optional();

export const typingEventPayloadSchema = z.object({
  conversationId: z.string().trim().min(1).max(200),
  actorType: z.enum([TYPING_ACTOR_TYPES.OWNER, TYPING_ACTOR_TYPES.PUBLIC]),
  actorId: optionalNullableId,
  expiresAt: z.string().datetime().nullable(),
}).strict().superRefine((payload, context) => {
  const isStarted = payload.expiresAt !== null && payload.expiresAt !== undefined;
  if (isStarted && new Date(payload.expiresAt).getTime() <= Date.now()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["expiresAt"],
      message: "Typing expiry must be in the future",
    });
  }
});

export const presenceEventPayloadSchema = z.object({
  workspaceId: z.string().trim().min(1).max(200),
  userId: z.string().trim().min(1).max(200),
  displayName: z.string().trim().min(1).max(120),
  actorType: z.literal(TYPING_ACTOR_TYPES.OWNER),
  status: z.enum([
    PRESENCE_STATUSES.ONLINE,
    PRESENCE_STATUSES.AWAY,
    PRESENCE_STATUSES.OFFLINE,
  ]),
  conversationId: optionalNullableId,
}).strict();

export const viewingEventPayloadSchema = z.object({
  workspaceId: z.string().trim().min(1).max(200),
  conversationId: z.string().trim().min(1).max(200),
  userId: z.string().trim().min(1).max(200),
  actorType: z.literal(TYPING_ACTOR_TYPES.OWNER),
}).strict();

export function parseEphemeralEvent(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid ephemeral event");
  }

  const eventType = raw.eventType;
  let payloadSchema;
  if (eventType === REALTIME_EVENT_TYPES.TYPING_STARTED || eventType === REALTIME_EVENT_TYPES.TYPING_STOPPED) {
    payloadSchema = typingEventPayloadSchema;
  } else if (eventType === REALTIME_EVENT_TYPES.PRESENCE_UPDATED) {
    payloadSchema = presenceEventPayloadSchema;
  } else if (eventType === REALTIME_EVENT_TYPES.VIEWING_STARTED || eventType === REALTIME_EVENT_TYPES.VIEWING_STOPPED) {
    payloadSchema = viewingEventPayloadSchema;
  } else {
    throw new Error("Unsupported ephemeral event type");
  }

  const result = payloadSchema.safeParse(raw.payload);
  if (!result.success) {
    throw new Error("Invalid ephemeral event payload");
  }
  if (
    (eventType === REALTIME_EVENT_TYPES.TYPING_STARTED && !result.data.expiresAt)
    || (eventType === REALTIME_EVENT_TYPES.TYPING_STOPPED && result.data.expiresAt !== null)
  ) {
    throw new Error("Invalid typing event expiry");
  }
  return { eventType, payload: result.data };
}

export function ephemeralRooms({ eventType, payload }) {
  const parsed = parseEphemeralEvent({ eventType, payload });
  const { conversationId, workspaceId } = parsed.payload;

  if (parsed.eventType === REALTIME_EVENT_TYPES.TYPING_STARTED || parsed.eventType === REALTIME_EVENT_TYPES.TYPING_STOPPED) {
    return [
      REALTIME_ROOMS.conversationOwner(conversationId),
      REALTIME_ROOMS.conversationPublic(conversationId),
    ];
  }

  if (parsed.eventType === REALTIME_EVENT_TYPES.PRESENCE_UPDATED) {
    const targets = [REALTIME_ROOMS.workspaceDesk(workspaceId)];
    if (conversationId) targets.push(REALTIME_ROOMS.conversationOwner(conversationId));
    return targets;
  }

  return [REALTIME_ROOMS.conversationOwner(conversationId)];
}

export function isEphemeralEventType(eventType) {
  return REALTIME_EPHEMERAL_EVENT_TYPES.includes(eventType);
}
