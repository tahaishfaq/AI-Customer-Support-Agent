/** Level 2 · M5 — guidance rule validation (shared by the API and the editor; no server imports). */

import { z } from "zod";

export const MAX_GUIDANCE_RULES = 30;
export const GUIDANCE_PROMPT_BUDGET = 3000;

const text = (max) => z.string().trim().max(max);

export const guidanceRuleSchema = z
  .object({
    id: z.string().trim().regex(/^[A-Za-z0-9_-]{1,40}$/, "Invalid rule id"),
    title: text(80).min(1, "Give the rule a short title"),
    when: text(300).default(""),
    then: text(800).min(1, "Describe what the agent should do"),
    enabled: z.boolean().default(true),
  })
  .strip();

export const guidanceSchema = z
  .array(guidanceRuleSchema)
  .max(MAX_GUIDANCE_RULES, `Up to ${MAX_GUIDANCE_RULES} rules`)
  .refine((rules) => new Set(rules.map((rule) => rule.id)).size === rules.length, "Rule ids must be unique");
