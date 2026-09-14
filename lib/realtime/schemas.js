import { z } from "zod";
import { REALTIME_VISIBILITIES } from "./constants.js";

export const ownerRealtimeClaimsSchema = z.object({
  sub: z.string().min(1),
  sid: z.string().min(1),
  jti: z.string().min(1),
  typ: z.literal("aide-realtime-owner"),
  iss: z.string().min(1),
  aud: z.string().min(1),
  role: z.string().min(1),
  workspaceIds: z.array(z.string().min(1)).max(100),
  iat: z.number().int().positive(),
  exp: z.number().int().positive(),
});

export const publicRealtimeClaimsSchema = z.object({
  sub: z.string().startsWith("conversation:"),
  sid: z.string().min(1),
  jti: z.string().min(1),
  typ: z.literal("aide-realtime-public-conversation"),
  iss: z.string().min(1),
  aud: z.string().min(1),
  conversationId: z.string().min(1),
  agentId: z.string().min(1),
  publicKeyId: z.string().min(1),
  customerSubjectHash: z.string().nullable(),
  originHash: z.string().nullable(),
  iat: z.number().int().positive(),
  exp: z.number().int().positive(),
});

export const realtimeEventSchema = z.object({
  eventId: z.string().uuid(),
  eventType: z.string().min(1).max(120),
  schemaVersion: z.number().int().positive(),
  occurredAt: z.string().datetime(),
  userId: z.string().nullable(),
  workspaceId: z.string().nullable(),
  agentId: z.string().nullable(),
  conversationId: z.string().nullable(),
  aggregateType: z.string().min(1).max(80),
  aggregateVersion: z.number().int().nonnegative(),
  visibility: z.enum([
    REALTIME_VISIBILITIES.OWNER,
    REALTIME_VISIBILITIES.PUBLIC,
    REALTIME_VISIBILITIES.BOTH,
  ]),
  payload: z.record(z.string(), z.unknown()),
});

export const joinRoomSchema = z.object({
  room: z.string().min(1).max(240),
});
