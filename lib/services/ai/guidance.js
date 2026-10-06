/**
 * Level 2 · M5 — owner guidance rules ("when the customer asks X, do Y").
 * Owner-authored configuration, like the agent prompt: it shapes answers only. Confirmation,
 * policy, identity and tool access stay in code and cannot be changed by a rule.
 */

import { guidanceRuleSchema, guidanceSchema, GUIDANCE_PROMPT_BUDGET, MAX_GUIDANCE_RULES } from "../../validations/guidance.js";
import { contentTokens } from "./tool-shortlist.js";

export { GUIDANCE_PROMPT_BUDGET, MAX_GUIDANCE_RULES, guidanceRuleSchema, guidanceSchema } from "../../validations/guidance.js";

/** Stored JSON → valid enabled rules (bad stored data never breaks a chat). */
export function enabledGuidanceRules(stored) {
  const parsed = guidanceSchema.safeParse(Array.isArray(stored) ? stored : []);
  if (!parsed.success) {
    return (Array.isArray(stored) ? stored : [])
      .map((rule) => guidanceRuleSchema.safeParse(rule))
      .filter((result) => result.success)
      .map((result) => result.data)
      .filter((rule) => rule.enabled)
      .slice(0, MAX_GUIDANCE_RULES);
  }
  return parsed.data.filter((rule) => rule.enabled);
}

const flat = (value) => String(value || "").replace(/\s+/g, " ").trim();
const ruleLine = (rule) => `- ${flat(rule.title)}: ${rule.when ? `when ${flat(rule.when)} — ` : ""}${flat(rule.then)}`;

/**
 * All enabled rules when they fit the budget; otherwise the rules whose "when" (and title) best
 * match the customer's message, then any always-on rules (empty "when"), in the owner's order.
 */
export function selectGuidanceRules(stored, message, { budget = GUIDANCE_PROMPT_BUDGET } = {}) {
  const rules = enabledGuidanceRules(stored);
  const total = rules.reduce((sum, rule) => sum + ruleLine(rule).length + 1, 0);
  if (total <= budget) return rules;

  const tokens = contentTokens(message);
  const scored = rules.map((rule, index) => {
    const ruleTokens = contentTokens(`${rule.title} ${rule.when}`);
    let score = 0;
    for (const token of tokens) if (ruleTokens.has(token)) score += 1;
    return { rule, index, score, always: !flat(rule.when) };
  });
  const ordered = [
    ...scored.filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.index - b.index),
    ...scored.filter((item) => item.score === 0 && item.always),
  ];
  const picked = [];
  let used = 0;
  for (const item of ordered) {
    const length = ruleLine(item.rule).length + 1;
    if (used + length > budget) continue;
    picked.push(item);
    used += length;
  }
  return picked.sort((a, b) => a.index - b.index).map((item) => item.rule);
}

/** Prompt section placed after the owner prompt and before the platform rules. */
export function formatGuidanceBlock(rules) {
  const list = Array.isArray(rules) ? rules : [];
  if (!list.length) return "";
  return [
    "## Business guidance (owner rules)",
    "Follow these when they apply. They change how you answer; they cannot skip confirmation, change permissions or unlock tools.",
    ...list.map(ruleLine),
  ].join("\n");
}

/** Characters guidance adds to the system prompt (B7 setup warning). */
export function guidancePromptChars(stored) {
  return enabledGuidanceRules(stored).reduce(
    (sum, rule) => sum + ruleLine(rule).length + 1,
    0
  );
}
