import assert from "node:assert/strict";
import { test } from "node:test";
import { luhnOk, redactPiiText, normalizePrivacy } from "../lib/privacy/redaction.js";
import {
  isChargeableResolution,
  shouldReverseCharge,
  SETTLE_MS,
  REVERSE_WINDOW_MS,
} from "../lib/billing/resolution-charge.js";
import { assignAbBucket, abReadyToStop, normalizeAbTest } from "../lib/ab/bucket.js";

test("L6 Luhn detects valid cards", () => {
  assert.equal(luhnOk("4111111111111111"), true);
  assert.equal(luhnOk("4111111111111112"), false);
});

test("L6 redaction masks when enabled and respects pattern toggles", () => {
  const text = "Mail a@b.com card 4111111111111111 phone +92 300 1234567 CNIC 12345-1234567-1 IBAN PK36SCBL0000001123456702";
  const on = redactPiiText(text, { redactPii: true });
  assert.ok(on.includes("[email]"));
  assert.ok(on.includes("[card]"));
  assert.ok(on.includes("[phone]") || on.includes("[cnic]") || on.includes("[iban]"));

  const phoneOff = redactPiiText("call 03001234567", {
    redactPii: true,
    patterns: { phone: false, email: true, card: true, cnic: true, iban: true },
  });
  assert.ok(phoneOff.includes("03001234567"));

  assert.equal(normalizePrivacy(null).redactPii, false);
  assert.equal(normalizePrivacy({ retentionDays: 10 }).retentionDays, 30);
});

test("L5 charge eligibility and reverse window", () => {
  const settled = {
    source: "EMBED",
    isSimulation: false,
    handoffCount: 0,
    negativeFeedback: false,
    lastAnswerState: "ANSWERED",
    lastMessageAt: new Date(Date.now() - SETTLE_MS - 1000),
  };
  assert.equal(isChargeableResolution(settled), true);
  assert.equal(isChargeableResolution({ ...settled, source: "STUDIO" }), false);
  assert.equal(isChargeableResolution({ ...settled, isSimulation: true }), false);
  assert.equal(isChargeableResolution({ ...settled, handoffCount: 1 }), false);

  assert.equal(
    shouldReverseCharge({
      chargedAt: new Date(Date.now() - 1000),
      reason: "thumbs_down",
    }),
    true
  );
  assert.equal(
    shouldReverseCharge({
      chargedAt: new Date(Date.now() - REVERSE_WINDOW_MS - 1000),
      reason: "thumbs_down",
    }),
    false
  );
});

test("L8 A/B bucketing is stable and never auto-promotes", () => {
  const config = normalizeAbTest({ enabled: true, revisionA: 1, revisionB: 2, minSample: 50 });
  const first = assignAbBucket("visitor-123", config);
  const second = assignAbBucket("visitor-123", config);
  assert.deepEqual(first, second);
  assert.ok(first.bucket === "A" || first.bucket === "B");
  assert.equal(assignAbBucket("x", { enabled: false }), null);
  assert.equal(abReadyToStop({ samplesA: 49, samplesB: 50, minSample: 50 }), false);
  assert.equal(abReadyToStop({ samplesA: 50, samplesB: 50, minSample: 50 }), true);
});
