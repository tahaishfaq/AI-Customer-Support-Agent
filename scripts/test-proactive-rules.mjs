/**
 * Level 2 · P6 — targeted proactive messages: normalization, legacy message, page/audience/frequency.
 * Run: npm run test:proactive-rules
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_PROACTIVE_RULES,
  matchesPath,
  normalizePath,
  normalizeProactiveRule,
  normalizeProactiveRules,
  pickProactiveRule,
} from "../lib/embed/proactive-rules.js";
import { customizationSchema } from "../lib/validations/customization.js";

const rule = (over = {}) => ({ id: "r1", enabled: true, message: "Need help with pricing?", match: "prefix", path: "/pricing", delaySeconds: 5, audience: "all", frequency: "every_page", ...over });

test("legacy single message becomes one every-page rule; off means none", () => {
  assert.deepEqual(normalizeProactiveRules({ proactiveEnabled: true, proactiveMessage: "Hi!" }).map((r) => [r.message, r.match, r.delaySeconds]), [["Hi!", "any", 0]]);
  assert.equal(normalizeProactiveRules({ proactiveEnabled: true, proactiveMessage: "" })[0].message, "Hi! Need help?");
  assert.deepEqual(normalizeProactiveRules({ proactiveEnabled: false }), []);
  assert.deepEqual(normalizeProactiveRules(null), []);
  // New rules win over the legacy fields.
  assert.deepEqual(normalizeProactiveRules({ proactiveEnabled: true, proactiveMessage: "old", proactiveRules: [rule()] }).map((r) => r.id), ["r1"]);
});

test("bad stored data is cleaned, never breaks the widget", () => {
  assert.equal(normalizeProactiveRule({ message: "  " }), null, "empty message dropped");
  const cleaned = normalizeProactiveRule({ id: "bad id!", message: "x".repeat(300), match: "regex", delaySeconds: 99999, audience: "vip", frequency: "hourly" }, 2);
  assert.equal(cleaned.id, "rule_3");
  assert.equal(cleaned.message.length, 200);
  assert.equal(cleaned.match, "any");
  assert.equal(cleaned.delaySeconds, 600);
  assert.equal(cleaned.audience, "all");
  assert.equal(cleaned.frequency, "every_page");
  assert.equal(normalizeProactiveRule({ message: "hi", match: "contains", path: "" }).match, "any", "no path = every page");
  assert.equal(normalizeProactiveRules({ proactiveRules: Array.from({ length: 15 }, (_, i) => rule({ id: `r${i}` })) }).length, MAX_PROACTIVE_RULES);
  assert.equal(normalizeProactiveRule({ message: "hi", delaySeconds: -5 }).delaySeconds, 0);
});

test("paths: query/hash ignored, case-insensitive, contains vs prefix", () => {
  assert.equal(normalizePath("/Pricing?plan=pro#faq"), "/pricing");
  assert.equal(normalizePath("pricing"), "/pricing");
  assert.equal(normalizePath(""), "/");
  const prefix = normalizeProactiveRule(rule());
  assert.equal(matchesPath(prefix, "/pricing/enterprise"), true);
  assert.equal(matchesPath(prefix, "/docs/pricing"), false);
  const contains = normalizeProactiveRule(rule({ match: "contains", path: "Checkout" }));
  assert.equal(matchesPath(contains, "/shop/checkout/step-2"), true);
  assert.equal(matchesPath(normalizeProactiveRule(rule({ path: "pricing" })), "/pricing"), true, "prefix without leading slash");
});

test("pick: first match wins; audience; once per session/visitor; disabled skipped", () => {
  const rules = normalizeProactiveRules({
    proactiveRules: [
      rule({ id: "off", enabled: false, match: "any" }),
      rule({ id: "pricing" }),
      rule({ id: "members", match: "any", audience: "identified", message: "Welcome back!" }),
      rule({ id: "guests", match: "any", audience: "anonymous", frequency: "once_per_visitor", message: "First time here?" }),
    ],
  });
  assert.equal(pickProactiveRule({ rules, path: "/pricing", identified: false }).id, "pricing");
  assert.equal(pickProactiveRule({ rules, path: "/", identified: true }).id, "members");
  assert.equal(pickProactiveRule({ rules, path: "/", identified: false }).id, "guests");
  assert.equal(pickProactiveRule({ rules, path: "/", identified: false, seen: { visitor: new Set(["guests"]) } }), null, "once per visitor used up");
  const session = normalizeProactiveRules({ proactiveRules: [rule({ id: "s", match: "any", frequency: "once_per_session" })] });
  assert.equal(pickProactiveRule({ rules: session, path: "/", identified: false, seen: { session: ["s"] } }), null);
  assert.equal(pickProactiveRule({ rules: [], path: "/", identified: false }), null);
});

test("server validation: path required for page rules, limits, duplicate ids", () => {
  const ok = customizationSchema.safeParse({ deploy: { proactiveRules: [rule()] } });
  assert.equal(ok.success, true, JSON.stringify(ok.error?.issues));
  assert.equal(customizationSchema.safeParse({ deploy: { proactiveRules: [rule({ path: "" })] } }).success, false);
  assert.equal(customizationSchema.safeParse({ deploy: { proactiveRules: [rule({ message: "" })] } }).success, false);
  assert.equal(customizationSchema.safeParse({ deploy: { proactiveRules: [rule({ delaySeconds: 601 })] } }).success, false);
  assert.equal(customizationSchema.safeParse({ deploy: { proactiveRules: [rule(), rule()] } }).success, false, "duplicate id");
  assert.equal(customizationSchema.safeParse({ deploy: { proactiveRules: Array.from({ length: 11 }, (_, i) => rule({ id: `r${i}` })) } }).success, false);
  assert.equal(customizationSchema.safeParse({ deploy: { proactiveRules: [rule({ match: "any", path: "" })] } }).success, true);
});
