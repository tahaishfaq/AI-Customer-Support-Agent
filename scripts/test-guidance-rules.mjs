/**
 * Level 2 · M5 — owner guidance rules: validation, selection within the prompt budget, placement.
 * Run: npm run test:guidance-rules
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GUIDANCE_PROMPT_BUDGET,
  enabledGuidanceRules,
  formatGuidanceBlock,
  guidancePromptChars,
  guidanceSchema,
  selectGuidanceRules,
} from "../lib/services/ai/guidance.js";
import { buildChatSystemPrompt } from "../lib/services/ai/prompt-builder.js";

const rule = (id, title, when, then, enabled = true) => ({ id, title, when, then, enabled });
const refunds = rule("r1", "Refunds", "customer asks for a refund", "Ask for the order number first, then explain the 14-day policy.");
const tone = rule("r2", "Tone", "", "Always greet the customer by name when known.");
const shipping = rule("r3", "Shipping delays", "order is late or delayed shipping", "Apologise once and give the tracking link.");

test("validation: required fields, limits, unique ids, unknown keys stripped", () => {
  assert.equal(guidanceSchema.safeParse([refunds, tone]).success, true);
  assert.equal(guidanceSchema.safeParse([{ ...refunds, then: "" }]).success, false, "then required");
  assert.equal(guidanceSchema.safeParse([{ ...refunds, title: "" }]).success, false, "title required");
  assert.equal(guidanceSchema.safeParse([{ ...refunds, then: "x".repeat(801) }]).success, false);
  assert.equal(guidanceSchema.safeParse([{ ...refunds, id: "bad id!" }]).success, false);
  assert.equal(guidanceSchema.safeParse([refunds, { ...tone, id: "r1" }]).success, false, "duplicate ids");
  assert.equal(guidanceSchema.safeParse(Array.from({ length: 31 }, (_, i) => rule(`r${i}`, "t", "", "do"))).success, false);
  assert.deepEqual(guidanceSchema.parse([{ ...tone, extra: "x" }])[0], tone);
  assert.equal(guidanceSchema.parse([{ id: "a", title: "t", then: "do" }])[0].when, "", "when defaults to always");
});

test("stored data: disabled rules skipped; one bad row never breaks the rest", () => {
  assert.deepEqual(enabledGuidanceRules([refunds, { ...tone, enabled: false }]).map((r) => r.id), ["r1"]);
  assert.deepEqual(enabledGuidanceRules([refunds, { junk: true }, shipping]).map((r) => r.id), ["r1", "r3"]);
  assert.deepEqual(enabledGuidanceRules(null), []);
  assert.deepEqual(enabledGuidanceRules("nope"), []);
});

test("selection: everything when it fits; relevant + always-on when it does not", () => {
  assert.deepEqual(selectGuidanceRules([refunds, tone, shipping], "hello").map((r) => r.id), ["r1", "r2", "r3"]);
  const filler = Array.from({ length: 25 }, (_, i) => rule(`f${i}`, `Filler ${i}`, `unrelated topic number ${i}`, "x".repeat(150)));
  const picked = selectGuidanceRules([refunds, ...filler, tone, shipping], "I want a refund for my order").map((r) => r.id);
  assert.ok(picked.includes("r1"), "matching rule kept");
  assert.ok(picked.includes("r2"), "always-on rule kept");
  assert.ok(picked.indexOf("r1") < picked.indexOf("r2"), "owner order preserved");
  const block = formatGuidanceBlock(selectGuidanceRules([refunds, ...filler, tone, shipping], "refund please"));
  assert.ok(block.length <= GUIDANCE_PROMPT_BUDGET + 250, `block ${block.length}`);
});

test("prompt: guidance after the owner prompt, before platform rules; none → unchanged", () => {
  const agent = { id: "a1", systemPrompt: "You are the Brandly support agent.", answerStyle: "HYBRID" };
  const guidanceText = formatGuidanceBlock([refunds, tone]);
  const withGuidance = buildChatSystemPrompt({ agent, guidanceText });
  const owner = withGuidance.indexOf("You are the Brandly support agent.");
  const guide = withGuidance.indexOf("## Business guidance (owner rules)");
  const platform = withGuidance.indexOf("## Response rules");
  assert.ok(owner === 0 && owner < guide && guide < platform);
  assert.match(withGuidance, /- Refunds: when customer asks for a refund — Ask for the order number first/);
  assert.match(withGuidance, /- Tone: Always greet the customer by name/);
  assert.match(withGuidance, /cannot skip confirmation, change permissions or unlock tools/);
  assert.equal(buildChatSystemPrompt({ agent }), buildChatSystemPrompt({ agent, guidanceText: "" }), "no guidance = previous prompt");
  assert.equal(formatGuidanceBlock([]), "");
});

test("Roman Urdu when-text matches selection; guidance chars count for B7", () => {
  const urdu = rule("ru1", "Refund Roman", "refund kab milega ya order status", "Order number poochho");
  const picked = selectGuidanceRules([urdu, tone], "mera refund kab milega?");
  assert.ok(picked.some((r) => r.id === "ru1"));
  const chars = guidancePromptChars([urdu, tone]);
  assert.ok(chars > 40);
  assert.equal(guidancePromptChars([]), 0);
  assert.equal(guidancePromptChars(null), 0);
});
