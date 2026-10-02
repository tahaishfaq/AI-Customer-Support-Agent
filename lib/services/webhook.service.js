/**
 * Level 2 · P7 — outbound webhooks.
 *
 * Source of events: RealtimeOutboxEvent (already written for every message, handoff, status, CSAT…).
 * A dispatch (run in after() once a request that wrote an event has responded, and when the
 * Developers page loads) copies new events past each webhook's cursor into WebhookDelivery rows —
 * unique per (webhook, event), so an event is never sent twice — then sends what is due.
 * Sending: https only, URL + DNS checked before every request (no private/metadata addresses),
 * no redirects, 5 s timeout, HMAC signature. Failures back off (1 m → 12 h) and a webhook that keeps
 * failing is switched off. Chat never waits for a webhook.
 */

import prisma from "@/lib/prisma";
import { assertActionUrlSafePinned } from "@/lib/actions/ssrf";
import { decryptSecret, encryptSecret } from "@/lib/actions/secrets";
import { writeAuditEvent } from "@/lib/services/audit.service";
import { resolveWorkspaceForManager } from "@/lib/services/workspace-manager";
import { safeLogError } from "@/lib/observability/safe-log";
import {
  WEBHOOK_AUTO_DISABLE_AFTER,
  WEBHOOK_EVENT_TYPES,
  WEBHOOK_MAX_PAYLOAD_BYTES,
  WEBHOOK_TIMEOUT_MS,
  buildWebhookPayload,
  generateWebhookSecret,
  isAllowedWebhookUrl,
  nextRetry,
  signWebhook,
} from "@/lib/webhooks/webhooks";

const MAX_WEBHOOKS_PER_WORKSPACE = 10;
const FANOUT_BATCH = 100;
const SEND_BATCH = 20;

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

function cleanEvents(events) {
  const list = [...new Set((Array.isArray(events) ? events : []).map(String))].filter((type) =>
    WEBHOOK_EVENT_TYPES.includes(type)
  );
  if (!list.length) throw httpError(400, "Choose at least one event");
  return list;
}

/** Local development may post to http://localhost; production is https + public hosts only. */
async function assertDeliverableUrl(url) {
  const allowLocal = process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(String(url));
  if (!allowLocal && !isAllowedWebhookUrl(url)) {
    throw httpError(400, "Webhook URL must be https (no credentials in the URL)", { code: "WEBHOOK_URL_INVALID" });
  }
  try {
    await assertActionUrlSafePinned(url, { allowLocalDemo: allowLocal });
  } catch (err) {
    throw httpError(400, err.message || "Webhook URL is not allowed", { code: "WEBHOOK_URL_BLOCKED" });
  }
}

function serializeWebhook(row) {
  return {
    id: row.id,
    url: row.url,
    events: Array.isArray(row.events) ? row.events : [],
    includeMessageText: row.includeMessageText,
    enabled: row.enabled,
    consecutiveFailures: row.consecutiveFailures,
    disabledReason: row.disabledReason,
    createdAt: row.createdAt,
  };
}

async function loadOwnWebhook(userId, webhookId) {
  const { workspace } = await resolveWorkspaceForManager(userId);
  const row = await prisma.workspaceWebhook.findFirst({ where: { id: String(webhookId), workspaceId: workspace.id } });
  if (!row) throw httpError(404, "Webhook not found");
  return { workspace, row };
}

// ── Management (Owner / Admin) ──────────────────────────────────────────────────────────────────

export async function listWebhooksForUser(userId) {
  const { workspace } = await resolveWorkspaceForManager(userId);
  const rows = await prisma.workspaceWebhook.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "asc" } });
  // Opening the settings also sends anything due (retries do not wait for the next chat event).
  if (rows.some((row) => row.enabled)) scheduleWebhookDispatch(workspace.id);
  return { webhooks: rows.map(serializeWebhook), events: WEBHOOK_EVENT_TYPES };
}

/** Returns the signing secret once; it is stored encrypted and never shown again. */
export async function createWebhookForUser(userId, { url, events, includeMessageText = false }) {
  const { workspace } = await resolveWorkspaceForManager(userId);
  const count = await prisma.workspaceWebhook.count({ where: { workspaceId: workspace.id } });
  if (count >= MAX_WEBHOOKS_PER_WORKSPACE) throw httpError(400, `Up to ${MAX_WEBHOOKS_PER_WORKSPACE} webhooks per workspace`);
  const cleanUrl = String(url || "").trim();
  await assertDeliverableUrl(cleanUrl);
  const secret = generateWebhookSecret();
  const row = await prisma.workspaceWebhook.create({
    data: {
      workspaceId: workspace.id,
      url: cleanUrl,
      secretCiphertext: encryptSecret(secret),
      events: cleanEvents(events),
      includeMessageText: Boolean(includeMessageText),
      createdByUserId: userId,
      // Only events from now on: a new webhook never replays history.
      cursorAt: new Date(),
    },
  });
  await writeAuditEvent({ adminId: userId, action: "webhook.create", targetType: "workspace", targetId: workspace.id, metadata: { webhookId: row.id, host: new URL(cleanUrl).host } });
  return { webhook: serializeWebhook(row), secret };
}

export async function updateWebhookForUser(userId, webhookId, patch = {}) {
  const { workspace, row } = await loadOwnWebhook(userId, webhookId);
  const data = {};
  if (patch.url !== undefined) {
    const cleanUrl = String(patch.url || "").trim();
    await assertDeliverableUrl(cleanUrl);
    data.url = cleanUrl;
  }
  if (patch.events !== undefined) data.events = cleanEvents(patch.events);
  if (patch.includeMessageText !== undefined) data.includeMessageText = Boolean(patch.includeMessageText);
  if (patch.enabled !== undefined) {
    data.enabled = Boolean(patch.enabled);
    if (data.enabled && !row.enabled) {
      // Turning back on: start fresh from now (no flood of old events).
      Object.assign(data, { consecutiveFailures: 0, disabledReason: null, cursorAt: new Date(), cursorEventId: null });
    }
  }
  const updated = await prisma.workspaceWebhook.update({ where: { id: row.id }, data });
  await writeAuditEvent({ adminId: userId, action: "webhook.update", targetType: "workspace", targetId: workspace.id, metadata: { webhookId: row.id, fields: Object.keys(data) } });
  return { webhook: serializeWebhook(updated) };
}

export async function deleteWebhookForUser(userId, webhookId) {
  const { workspace, row } = await loadOwnWebhook(userId, webhookId);
  await prisma.workspaceWebhook.delete({ where: { id: row.id } });
  await writeAuditEvent({ adminId: userId, action: "webhook.delete", targetType: "workspace", targetId: workspace.id, metadata: { webhookId: row.id } });
  return { ok: true };
}

export async function rotateWebhookSecretForUser(userId, webhookId) {
  const { workspace, row } = await loadOwnWebhook(userId, webhookId);
  const secret = generateWebhookSecret();
  await prisma.workspaceWebhook.update({ where: { id: row.id }, data: { secretCiphertext: encryptSecret(secret) } });
  await writeAuditEvent({ adminId: userId, action: "webhook.rotate_secret", targetType: "workspace", targetId: workspace.id, metadata: { webhookId: row.id } });
  return { secret };
}

export async function listDeliveriesForUser(userId, webhookId) {
  const { row } = await loadOwnWebhook(userId, webhookId);
  const deliveries = await prisma.webhookDelivery.findMany({
    where: { webhookId: row.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, eventId: true, eventType: true, status: true, attempts: true, lastStatusCode: true, lastError: true, nextAttemptAt: true, deliveredAt: true, createdAt: true },
  });
  return { deliveries };
}

/** Send a "ping" to check the endpoint and signature right away. */
export async function sendTestWebhookForUser(userId, webhookId) {
  const { row } = await loadOwnWebhook(userId, webhookId);
  const eventId = `ping_${Date.now().toString(36)}`;
  const payload = { id: eventId, type: "webhook.ping", createdAt: new Date().toISOString(), workspaceId: row.workspaceId, data: { message: "Test event from AIDE" } };
  const delivery = await prisma.webhookDelivery.create({
    data: { webhookId: row.id, eventId, eventType: "webhook.ping", payload },
  });
  const result = await attemptDelivery(row, delivery, { countTowardsDisable: false });
  return { delivery: { id: delivery.id, ...result } };
}

// ── Delivery ────────────────────────────────────────────────────────────────────────────────────

/** POST one delivery. Never throws; records the outcome. */
async function attemptDelivery(webhook, delivery, { countTowardsDisable = true } = {}) {
  const attempts = delivery.attempts + 1;
  let statusCode = null;
  let errorCode = null;
  try {
    await assertDeliverableUrl(webhook.url);
    const body = JSON.stringify(delivery.payload);
    if (Buffer.byteLength(body) > WEBHOOK_MAX_PAYLOAD_BYTES) throw Object.assign(new Error("payload too large"), { code: "PAYLOAD_TOO_LARGE" });
    const secret = decryptSecret(webhook.secretCiphertext);
    const { header } = signWebhook(secret, body);
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "AIDE-Webhooks/1",
        "x-aide-event-id": delivery.eventId,
        "x-aide-event-type": delivery.eventType,
        "x-aide-signature": header,
      },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    });
    statusCode = response.status;
    // Read (and discard) at most a little of the body so the connection is released.
    await response.body?.cancel?.().catch(() => null);
    if (statusCode < 200 || statusCode >= 300) errorCode = statusCode >= 300 && statusCode < 400 ? "REDIRECT_NOT_FOLLOWED" : `HTTP_${statusCode}`;
  } catch (err) {
    errorCode = err?.name === "TimeoutError" ? "TIMEOUT" : err?.details?.code || err?.code || "NETWORK_ERROR";
  }

  if (!errorCode) {
    await prisma.$transaction([
      prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: "SUCCEEDED", attempts, lastStatusCode: statusCode, lastError: null, deliveredAt: new Date() },
      }),
      prisma.workspaceWebhook.update({ where: { id: webhook.id }, data: { consecutiveFailures: 0 } }),
    ]);
    return { status: "SUCCEEDED", statusCode };
  }

  const retry = nextRetry(attempts);
  await prisma.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status: retry.status,
      attempts,
      lastStatusCode: statusCode,
      lastError: String(errorCode).slice(0, 60),
      nextAttemptAt: retry.nextAttemptAt || new Date(),
    },
  });
  if (countTowardsDisable) {
    const updated = await prisma.workspaceWebhook.update({
      where: { id: webhook.id },
      data: { consecutiveFailures: { increment: 1 } },
      select: { consecutiveFailures: true },
    });
    if (updated.consecutiveFailures >= WEBHOOK_AUTO_DISABLE_AFTER) {
      await prisma.workspaceWebhook.update({
        where: { id: webhook.id },
        data: { enabled: false, disabledReason: `Switched off after ${WEBHOOK_AUTO_DISABLE_AFTER} failed deliveries in a row` },
      });
    }
  }
  return { status: retry.status, statusCode, error: errorCode };
}

/** Copy new outbox events past the webhook's cursor into deliveries (unique → never twice). */
async function fanOut(webhook) {
  const events = Array.isArray(webhook.events) ? webhook.events : [];
  if (!events.length) return 0;
  const rows = await prisma.realtimeOutboxEvent.findMany({
    where: {
      workspaceId: webhook.workspaceId,
      OR: [
        { createdAt: { gt: webhook.cursorAt } },
        ...(webhook.cursorEventId ? [{ createdAt: webhook.cursorAt, eventId: { gt: webhook.cursorEventId } }] : [{ createdAt: webhook.cursorAt }]),
      ],
    },
    orderBy: [{ createdAt: "asc" }, { eventId: "asc" }],
    take: FANOUT_BATCH,
    select: { eventId: true, eventType: true, payload: true, createdAt: true, workspaceId: true, agentId: true, conversationId: true },
  });
  if (!rows.length) return 0;
  const data = rows
    .filter((row) => events.includes(row.eventType))
    .map((row) => ({ row, payload: buildWebhookPayload(row, { includeMessageText: webhook.includeMessageText }) }))
    .filter((item) => item.payload)
    .map(({ row, payload }) => ({ webhookId: webhook.id, eventId: row.eventId, eventType: row.eventType, payload }));
  const last = rows[rows.length - 1];
  await prisma.$transaction([
    ...(data.length ? [prisma.webhookDelivery.createMany({ data, skipDuplicates: true })] : []),
    // Advance only if nobody else moved the cursor meanwhile.
    prisma.workspaceWebhook.updateMany({
      where: { id: webhook.id, cursorAt: webhook.cursorAt, cursorEventId: webhook.cursorEventId },
      data: { cursorAt: last.createdAt, cursorEventId: last.eventId },
    }),
  ]);
  return data.length;
}

/** Deliveries that are due, claimed one by one so two dispatches never send the same one. */
async function sendDue(webhook) {
  const due = await prisma.webhookDelivery.findMany({
    where: { webhookId: webhook.id, status: { in: ["PENDING", "FAILED"] }, nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" },
    take: SEND_BATCH,
  });
  let sent = 0;
  for (const delivery of due) {
    // Lease: push nextAttemptAt forward; only the dispatch that wins the update sends.
    const claimed = await prisma.webhookDelivery.updateMany({
      where: { id: delivery.id, status: delivery.status, nextAttemptAt: delivery.nextAttemptAt },
      data: { nextAttemptAt: new Date(Date.now() + 60_000) },
    });
    if (claimed.count !== 1) continue;
    const fresh = await prisma.workspaceWebhook.findUnique({ where: { id: webhook.id } });
    if (!fresh?.enabled) break;
    await attemptDelivery(fresh, delivery);
    sent += 1;
  }
  return sent;
}

const lastDispatch = new Map();

/** Fan out and send for every enabled webhook of a workspace. Never throws. */
export async function dispatchWorkspaceWebhooks(workspaceId, { minIntervalMs = 1_500 } = {}) {
  if (!workspaceId) return { skipped: true };
  const now = Date.now();
  if (now - (lastDispatch.get(workspaceId) || 0) < minIntervalMs) return { skipped: true };
  lastDispatch.set(workspaceId, now);
  try {
    const webhooks = await prisma.workspaceWebhook.findMany({ where: { workspaceId, enabled: true } });
    let queued = 0;
    let sent = 0;
    for (const webhook of webhooks) {
      queued += await fanOut(webhook);
      sent += await sendDue(webhook);
    }
    return { webhooks: webhooks.length, queued, sent };
  } catch (err) {
    safeLogError("webhook dispatch failed", { workspaceId, code: err?.code || "WEBHOOK_DISPATCH_FAILED" });
    return { error: true };
  }
}

/**
 * Run a dispatch after the current response is sent (next/server `after`). Outside a request
 * (workers, scripts) this is a no-op; the next request that writes an event picks the work up.
 */
export function scheduleWebhookDispatch(workspaceId) {
  if (!workspaceId) return;
  import("next/server")
    .then(({ after }) => after(() => dispatchWorkspaceWebhooks(workspaceId)))
    .catch(() => null);
}
