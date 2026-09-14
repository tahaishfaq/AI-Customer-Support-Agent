import { z } from "zod";
import { REALTIME_EVENT_TYPES, REALTIME_VISIBILITIES } from "./constants.js";

const subscriptionStatuses = ["PENDING", "ACTIVE", "PAST_DUE", "CANCELED", "EXPIRED"];
const planTypes = ["FREE", "POPULAR", "TEAMS", "CUSTOM"];

export const subscriptionRealtimePayloadSchema = z.object({
  subscriptionId: z.string().trim().min(1).max(200),
  status: z.enum(subscriptionStatuses),
  planId: z.string().trim().min(1).max(200),
  currentPeriodEnd: z.string().datetime().nullable().optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
  action: z.enum([
    "activated",
    "canceled",
    "past_due",
    "expired",
    "updated",
    "token_recorded",
    "payment_failed",
    "ended",
  ]).optional(),
  providerEventType: z.string().trim().min(1).max(120).optional(),
}).strict();

export const quotaRealtimePayloadSchema = z.object({
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  unlimited: z.boolean(),
  used: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative().nullable(),
  remaining: z.number().int().nonnegative().nullable(),
  planType: z.enum(planTypes).nullable(),
}).strict().superRefine((payload, context) => {
  if (payload.unlimited && (payload.limit !== null || payload.remaining !== null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["limit"], message: "Unlimited quota must not expose a finite limit" });
  }
  if (!payload.unlimited && (payload.limit === null || payload.remaining === null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["limit"], message: "Finite quota requires limit and remaining" });
  }
});

export const inboxSeenRealtimePayloadSchema = z.object({
  workspaceId: z.string().trim().min(1).max(200),
  seenAt: z.string().datetime(),
}).strict();

const payloadSchemas = new Map([
  [REALTIME_EVENT_TYPES.BILLING_SUBSCRIPTION_UPDATED, subscriptionRealtimePayloadSchema],
  [REALTIME_EVENT_TYPES.BILLING_QUOTA_UPDATED, quotaRealtimePayloadSchema],
  [REALTIME_EVENT_TYPES.INBOX_SEEN_UPDATED, inboxSeenRealtimePayloadSchema],
]);

export function parseOwnerBusinessEvent(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw new Error("Invalid owner business event");
  }
  if (!event.userId || event.visibility !== REALTIME_VISIBILITIES.OWNER) {
    throw new Error("Owner business event must target one authenticated user");
  }
  const schema = payloadSchemas.get(event.eventType);
  if (!schema) throw new Error("Unsupported owner business event type");
  const result = schema.safeParse(event.payload);
  if (!result.success) throw new Error("Invalid owner business event payload");
  return { ...event, payload: result.data };
}

export function isOwnerBusinessEventType(eventType) {
  return payloadSchemas.has(eventType);
}
