/**
 * Level 2 · P7 — outbound webhooks. Pure: which events are offered, the payload a receiver gets,
 * the signature, and the retry schedule.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { WEBHOOK_EVENT_TYPES } from "./events.js";

export { WEBHOOK_EVENTS, WEBHOOK_EVENT_TYPES } from "./events.js";

export const WEBHOOK_TIMEOUT_MS = 5_000;
export const WEBHOOK_MAX_PAYLOAD_BYTES = 64 * 1024;
/** Retry delays after each failed attempt; after the last one the delivery is DEAD. */
export const WEBHOOK_BACKOFF_MS = Object.freeze([60_000, 5 * 60_000, 30 * 60_000, 2 * 3_600_000, 12 * 3_600_000]);
/** Consecutive failed attempts (any delivery) before the webhook is switched off. */
export const WEBHOOK_AUTO_DISABLE_AFTER = 20;
const MESSAGE_TEXT_MAX = 8_000;

export function generateWebhookSecret() {
  return `whsec_${randomBytes(32).toString("base64url")}`;
}

/**
 * Outbox row → body sent to the receiver, or null when it must not be sent.
 * Internal (team-only) notes are never sent. Message text only when the owner opted in.
 */
export function buildWebhookPayload(event, { includeMessageText = false } = {}) {
  if (!event || !WEBHOOK_EVENT_TYPES.includes(event.eventType)) return null;
  const source = event.payload && typeof event.payload === "object" ? event.payload : {};
  const role = String(source.role || "").toUpperCase();
  if (event.eventType === "conversation.message.created" && role === "INTERNAL") return null;

  const data = {};
  for (const [key, value] of Object.entries(source)) {
    if (key === "content") continue;
    // Keep plain values and small id/state objects; drop anything bulky.
    if (value === null || ["string", "number", "boolean"].includes(typeof value)) data[key] = value;
  }
  if (event.eventType === "conversation.message.created" && includeMessageText && typeof source.content === "string") {
    data.content = source.content.slice(0, MESSAGE_TEXT_MAX);
  }
  return {
    id: event.eventId,
    type: event.eventType,
    createdAt: new Date(event.createdAt).toISOString(),
    workspaceId: event.workspaceId || null,
    agentId: event.agentId || null,
    conversationId: event.conversationId || null,
    data,
  };
}

/** `x-aide-signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.body">` (Stripe-style). */
export function signWebhook(secret, body, timestamp = Math.floor(Date.now() / 1000)) {
  const signature = createHmac("sha256", String(secret)).update(`${timestamp}.${body}`).digest("hex");
  return { header: `t=${timestamp},v1=${signature}`, timestamp, signature };
}

/** Receiver-side check (used in tests and documented for customers). */
export function verifyWebhookSignature(secret, body, header, { toleranceSeconds = 300, now = Date.now() } = {}) {
  const parts = Object.fromEntries(
    String(header || "")
      .split(",")
      .map((part) => part.split("=", 2).map((s) => s.trim()))
      .filter((pair) => pair.length === 2)
  );
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !parts.v1) return false;
  if (Math.abs(now / 1000 - t) > toleranceSeconds) return false;
  const expected = Buffer.from(signWebhook(secret, body, t).signature, "hex");
  const given = Buffer.from(String(parts.v1), "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * After a failed attempt: next status and when to try again.
 * @returns {{ status: "FAILED"|"DEAD", nextAttemptAt: Date|null }}
 */
export function nextRetry(attempts, now = Date.now()) {
  const delay = WEBHOOK_BACKOFF_MS[attempts - 1];
  if (delay === undefined) return { status: "DEAD", nextAttemptAt: null };
  return { status: "FAILED", nextAttemptAt: new Date(now + delay) };
}

/** Only these URLs may receive webhooks (checked again, with DNS, before every send). */
export function isAllowedWebhookUrl(raw) {
  try {
    const url = new URL(String(raw || ""));
    return url.protocol === "https:" && !url.username && !url.password && url.href.length <= 2_000;
  } catch {
    return false;
  }
}
