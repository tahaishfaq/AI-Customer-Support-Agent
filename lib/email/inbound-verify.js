/**
 * Level 2 · P8 — verify Resend inbound webhooks (Svix-compatible HMAC).
 * Spec: https://resend.com/docs/webhooks/verify-webhooks-requests
 * Env: RESEND_INBOUND_SECRET (whsec_…)
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SEC = 5 * 60;

/**
 * @param {string} secret whsec_… from Resend webhook details
 * @param {string} payload raw body string
 * @param {{ id?: string|null, timestamp?: string|null, signature?: string|null }} headers
 * @param {{ now?: number }} [opts]
 * @returns {{ ok: true, event: object } | { ok: false, reason: string }}
 */
export function verifyResendInboundWebhook(secret, payload, headers = {}, opts = {}) {
  const whsec = String(secret || "").trim();
  if (!whsec) {
    return { ok: false, reason: "secret_missing" };
  }
  const id = String(headers.id || headers["svix-id"] || "").trim();
  const timestamp = String(
    headers.timestamp || headers["svix-timestamp"] || ""
  ).trim();
  const signature = String(
    headers.signature || headers["svix-signature"] || ""
  ).trim();
  if (!id || !timestamp || !signature) {
    return { ok: false, reason: "headers_missing" };
  }
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: "timestamp_invalid" };
  }
  const nowSec = Math.floor((opts.now ?? Date.now()) / 1000);
  if (Math.abs(nowSec - ts) > TOLERANCE_SEC) {
    return { ok: false, reason: "timestamp_stale" };
  }

  let key;
  try {
    key = decodeWhsec(whsec);
  } catch {
    return { ok: false, reason: "secret_invalid" };
  }

  const signedContent = `${id}.${timestamp}.${String(payload ?? "")}`;
  const expected = createHmac("sha256", key).update(signedContent).digest("base64");

  const candidates = signature.split(/\s+/).map((part) => {
    const [, sig] = String(part).split(",", 2);
    return sig || "";
  }).filter(Boolean);

  let matched = false;
  for (const candidate of candidates) {
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(candidate);
      if (a.length === b.length && timingSafeEqual(a, b)) {
        matched = true;
        break;
      }
    } catch {
      // continue
    }
  }
  if (!matched) {
    return { ok: false, reason: "signature_mismatch" };
  }

  let event;
  try {
    event = JSON.parse(String(payload));
  } catch {
    return { ok: false, reason: "payload_invalid" };
  }
  return { ok: true, event };
}

function decodeWhsec(whsec) {
  const raw = whsec.startsWith("whsec_") ? whsec.slice("whsec_".length) : whsec;
  return Buffer.from(raw, "base64");
}

/**
 * Build a signed fixture for unit tests (mirrors Resend/Svix).
 */
export function signResendInboundFixture(secret, payload, opts = {}) {
  const id = opts.id || `msg_test_${Date.now()}`;
  const timestamp = String(
    opts.timestamp ?? Math.floor((opts.now ?? Date.now()) / 1000)
  );
  const key = decodeWhsec(secret);
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  const signedContent = `${id}.${timestamp}.${body}`;
  const sig = createHmac("sha256", key).update(signedContent).digest("base64");
  return {
    body,
    headers: {
      id,
      timestamp,
      signature: `v1,${sig}`,
      "svix-id": id,
      "svix-timestamp": timestamp,
      "svix-signature": `v1,${sig}`,
    },
  };
}
