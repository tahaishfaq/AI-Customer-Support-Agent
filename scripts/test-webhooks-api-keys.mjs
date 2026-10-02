/**
 * Level 2 · P7 — webhook payload/signature/retries and API key format/verification.
 * Run: npm run test:webhooks-api-keys
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  WEBHOOK_AUTO_DISABLE_AFTER,
  WEBHOOK_BACKOFF_MS,
  buildWebhookPayload,
  generateWebhookSecret,
  isAllowedWebhookUrl,
  nextRetry,
  signWebhook,
  verifyWebhookSignature,
} from "../lib/webhooks/webhooks.js";
import { WEBHOOK_EVENT_TYPES } from "../lib/webhooks/events.js";
import { apiKeyMatches, generateApiKey, hashApiKey, maskApiKey, parseApiKey } from "../lib/api-keys/api-keys.js";

const event = (over = {}) => ({
  eventId: "evt_1",
  eventType: "conversation.message.created",
  createdAt: "2026-09-30T10:00:00.000Z",
  workspaceId: "ws1",
  agentId: "a1",
  conversationId: "c1",
  payload: { messageId: "m1", role: "USER", content: "My card is 4242 4242 4242 4242", responseTime: null, citations: [{ big: true }] },
  ...over,
});

test("payload: ids only by default; text only when opted in; team notes never", () => {
  const plain = buildWebhookPayload(event());
  assert.deepEqual(plain.data, { messageId: "m1", role: "USER", responseTime: null });
  assert.ok(!JSON.stringify(plain).includes("4242"), "no message text unless opted in");
  assert.equal(plain.type, "conversation.message.created");
  assert.equal(plain.id, "evt_1");
  const withText = buildWebhookPayload(event(), { includeMessageText: true });
  assert.equal(withText.data.content, "My card is 4242 4242 4242 4242");
  assert.equal(buildWebhookPayload(event({ payload: { role: "INTERNAL", content: "secret note" } }), { includeMessageText: true }), null);
  assert.equal(buildWebhookPayload(event({ eventType: "conversation.typing.started" })), null, "not a webhook event");
  assert.equal(buildWebhookPayload(event({ eventType: "billing.quota.updated" })), null);
  assert.equal(buildWebhookPayload(null), null);
  assert.equal(buildWebhookPayload(event({ payload: { role: "USER", content: "x".repeat(20000) } }), { includeMessageText: true }).data.content.length, 8000);
  assert.ok(WEBHOOK_EVENT_TYPES.includes("conversation.handoff.created"));
});

test("signature: verifies, rejects tampering, wrong secret and stale timestamps", () => {
  const secret = generateWebhookSecret();
  assert.match(secret, /^whsec_[A-Za-z0-9_-]{40,}$/);
  const body = JSON.stringify({ a: 1 });
  const now = Date.now();
  const { header } = signWebhook(secret, body, Math.floor(now / 1000));
  assert.match(header, /^t=\d+,v1=[0-9a-f]{64}$/);
  assert.equal(verifyWebhookSignature(secret, body, header, { now }), true);
  assert.equal(verifyWebhookSignature(secret, body + " ", header, { now }), false, "body changed");
  assert.equal(verifyWebhookSignature("whsec_other", body, header, { now }), false, "wrong secret");
  assert.equal(verifyWebhookSignature(secret, body, header, { now: now + 10 * 60_000 }), false, "replayed later");
  assert.equal(verifyWebhookSignature(secret, body, "garbage", { now }), false);
});

test("retries back off 1m → 12h, then DEAD; auto-disable threshold", () => {
  const now = 1_000_000;
  assert.equal(nextRetry(1, now).nextAttemptAt.getTime(), now + 60_000);
  assert.equal(nextRetry(5, now).nextAttemptAt.getTime(), now + 12 * 3_600_000);
  assert.deepEqual(nextRetry(WEBHOOK_BACKOFF_MS.length + 1, now), { status: "DEAD", nextAttemptAt: null });
  assert.equal(nextRetry(2, now).status, "FAILED");
  assert.equal(WEBHOOK_AUTO_DISABLE_AFTER, 20);
});

test("webhook URLs: https only, no credentials", () => {
  assert.equal(isAllowedWebhookUrl("https://hooks.example.com/aide"), true);
  assert.equal(isAllowedWebhookUrl("http://hooks.example.com/aide"), false);
  assert.equal(isAllowedWebhookUrl("https://user:pass@hooks.example.com/"), false);
  assert.equal(isAllowedWebhookUrl("ftp://x"), false);
  assert.equal(isAllowedWebhookUrl("not a url"), false);
});

test("API keys: format, parse, constant-time match, only the hash is needed", () => {
  const { key, prefix, keyHash } = generateApiKey();
  assert.match(key, /^aide_sk_[A-Za-z0-9]{12}_[A-Za-z0-9_-]{43}$/);
  assert.equal(keyHash, hashApiKey(key));
  assert.deepEqual(parseApiKey(`Bearer ${key}`), { key, prefix });
  assert.equal(parseApiKey(`bearer ${key}`)?.prefix, prefix, "scheme is case-insensitive");
  assert.equal(parseApiKey(key), null, "Bearer required");
  assert.equal(parseApiKey("Bearer aide_sk_short_x"), null);
  assert.equal(parseApiKey(null), null);
  assert.equal(apiKeyMatches(key, keyHash), true);
  assert.equal(apiKeyMatches(`${key}x`, keyHash), false);
  assert.equal(apiKeyMatches(key, "not-hex"), false);
  assert.equal(maskApiKey(prefix), `aide_sk_${prefix}_••••`);
  assert.notEqual(generateApiKey().prefix, prefix);
});
