/**
 * Level 2 · P7 — after an outbox event a webhook could want, dispatch once the response is sent.
 * Lazy imports keep the outbox free of Next.js and service dependencies (workers import it too).
 */
import { WEBHOOK_EVENT_TYPES } from "./events.js";

export function scheduleWebhooksForEvent(eventType, workspaceId) {
  if (!workspaceId || !WEBHOOK_EVENT_TYPES.includes(eventType)) return;
  import("@/lib/services/webhook.service")
    .then(({ scheduleWebhookDispatch }) => scheduleWebhookDispatch(workspaceId))
    .catch(() => null);
}
