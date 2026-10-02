/**
 * Level 2 · P8 — inbound parse + Svix verify units.
 * Run: npm run test:email-inbound
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  INBOUND_TEXT_MAX,
  cleanMessageId,
  emailGuestSubject,
  extractEmailAddress,
  extractInboundBody,
  htmlToText,
  parseThreadHints,
  shouldIgnoreInbound,
  stripQuotedReply,
} from "../lib/email/inbound-parse.js";
import {
  signResendInboundFixture,
  verifyResendInboundWebhook,
} from "../lib/email/inbound-verify.js";

test("htmlToText strips tags and keeps breaks", () => {
  assert.equal(htmlToText("<p>Hello<br/>world</p>"), "Hello\nworld");
  assert.ok(!htmlToText("<script>alert(1)</script>Hi").includes("alert"));
});

test("stripQuotedReply removes On … wrote and signatures", () => {
  const body = stripQuotedReply(
    "Thanks for the update.\n\nOn Mon, Sam wrote:\n> old stuff\n\n-- \nSent from my phone"
  );
  assert.match(body, /Thanks for the update/);
  assert.ok(!body.includes("old stuff"));
  assert.ok(!body.includes("Sent from my phone"));
});

test("extractInboundBody caps at 25KB and prefers text", () => {
  const big = "x".repeat(INBOUND_TEXT_MAX + 50);
  const { text, truncated } = extractInboundBody({ text: big });
  assert.equal(text.length, INBOUND_TEXT_MAX);
  assert.equal(truncated, true);
  assert.equal(extractInboundBody({ text: "plain", html: "<p>ignored</p>" }).text, "plain");
  assert.equal(extractInboundBody({ html: "<p>from html</p>" }).text, "from html");
});

test("loop detection: auto-submitted, bulk, noreply", () => {
  assert.equal(
    shouldIgnoreInbound({ "auto-submitted": "auto-replied" }, {}).ignore,
    true
  );
  assert.equal(
    shouldIgnoreInbound({ precedence: "bulk" }, {}).ignore,
    true
  );
  assert.equal(
    shouldIgnoreInbound({}, { from: "Mailer-Daemon <mailer-daemon@example.com>" }).ignore,
    true
  );
  assert.equal(
    shouldIgnoreInbound({}, { from: "Customer <user@example.com>" }).ignore,
    false
  );
});

test("thread hints: In-Reply-To, References, subject token", () => {
  const hints = parseThreadHints(
    {
      "in-reply-to": "<abc@mail.example>",
      references: "<root@mail.example> <abc@mail.example>",
    },
    "Re: Help [aide:conv_abc123xyz]"
  );
  assert.equal(hints.inReplyTo, "abc@mail.example");
  assert.deepEqual(hints.references, ["root@mail.example", "abc@mail.example"]);
  assert.equal(hints.threadToken, "conv_abc123xyz");
  assert.equal(cleanMessageId("<x@y>"), "x@y");
  assert.equal(extractEmailAddress("Name <A@B.com>"), "a@b.com");
  assert.equal(emailGuestSubject("A@B.com"), "email:a@b.com");
});

test("Resend inbound Svix verify accepts good signature and rejects tampering", () => {
  const secret = "whsec_" + Buffer.from("test-inbound-secret-bytes!!").toString("base64");
  const event = {
    type: "email.received",
    data: {
      email_id: "ae2014de-c168-4c61-8267-69f62e732aa5",
      from: "user@example.com",
      to: ["support@help.example.com"],
      subject: "Need help",
    },
  };
  const now = Date.now();
  const { body, headers } = signResendInboundFixture(secret, event, { now });
  const ok = verifyResendInboundWebhook(secret, body, headers, { now });
  assert.equal(ok.ok, true);
  assert.equal(ok.event.type, "email.received");

  assert.equal(
    verifyResendInboundWebhook(secret, body + " ", headers, { now }).ok,
    false
  );
  assert.equal(
    verifyResendInboundWebhook("whsec_" + Buffer.from("other").toString("base64"), body, headers, { now }).ok,
    false
  );
  assert.equal(
    verifyResendInboundWebhook(secret, body, headers, { now: now + 10 * 60_000 }).ok,
    false
  );
  assert.equal(
    verifyResendInboundWebhook("", body, headers, { now }).reason,
    "secret_missing"
  );
});
