/** Level 2 · P7 — webhook event types (browser-safe; no crypto). Types come from the realtime outbox. */
export const WEBHOOK_EVENTS = Object.freeze({
  "conversation.message.created": "New message (customer, AI or agent)",
  "conversation.handoff.created": "Chat handed to a human",
  "conversation.status.updated": "Status changed (resolved, reopened)",
  "conversation.claim.updated": "Assigned or claimed",
  "conversation.priority.updated": "Priority changed",
  "conversation.csat.updated": "Customer rating",
});
export const WEBHOOK_EVENT_TYPES = Object.freeze(Object.keys(WEBHOOK_EVENTS));
