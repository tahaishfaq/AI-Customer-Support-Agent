import crypto from "node:crypto";
import { normalizeCheckoutReference } from "./checkout-reference.js";

export function extractEventMeta(body) {
  const data = body?.data && typeof body.data === "object" ? body.data : body;
  const eventType =
    data?.type || data?.event || body?.type || body?.event || "unknown";
  const externalId =
    data?.id ||
    body?.id ||
    data?.event_id ||
    crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex");
  const reference =
    data?.reference ||
    data?.subscription?.reference ||
    data?.metadata?.reference ||
    data?.checkout_reference ||
    null;
  const normalizedReference = normalizeCheckoutReference(reference);
  const subscriptionToken =
    data?.subscription?.token ||
    data?.subscription?.id ||
    data?.subscription_id ||
    data?.token ||
    null;
  const periodEndRaw =
    data?.current_period_end ||
    data?.subscription?.current_period_end ||
    data?.period_end ||
    null;

  return {
    eventType: String(eventType),
    externalId: String(externalId),
    reference: normalizedReference ? String(normalizedReference) : null,
    subscriptionToken: subscriptionToken ? String(subscriptionToken) : null,
    periodEnd: periodEndRaw ? new Date(periodEndRaw) : null,
  };
}
