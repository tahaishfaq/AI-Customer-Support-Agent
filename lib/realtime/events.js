import { randomUUID } from "node:crypto";
import { REALTIME_EVENT_SCHEMA_VERSION } from "./constants.js";
import { realtimeEventSchema } from "./schemas.js";

export function buildRealtimeEvent(input) {
  const event = {
    eventId: input.eventId || randomUUID(),
    eventType: input.eventType,
    schemaVersion: input.schemaVersion || REALTIME_EVENT_SCHEMA_VERSION,
    occurredAt: input.occurredAt || new Date().toISOString(),
    userId: input.userId ?? null,
    workspaceId: input.workspaceId ?? null,
    agentId: input.agentId ?? null,
    conversationId: input.conversationId ?? null,
    aggregateType: input.aggregateType,
    aggregateVersion: input.aggregateVersion ?? 0,
    visibility: input.visibility,
    payload: input.payload || {},
  };
  return realtimeEventSchema.parse(event);
}

export function serializeRealtimeEvent(event) {
  return JSON.stringify(realtimeEventSchema.parse(event));
}
