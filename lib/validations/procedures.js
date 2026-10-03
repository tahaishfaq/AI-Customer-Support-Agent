/** Level 3 · L4 — procedure authoring validation (shared; no server imports). */

import { z } from "zod";

export const MAX_PROCEDURES = 10;
export const PROCEDURE_PROMPT_BUDGET = 2_500;
export const PROCEDURE_TTL_MS = 30 * 60 * 1000;

const text = (max) => z.string().trim().max(max);

const fieldType = z.enum(["text", "email", "order_id", "number", "phone"]);

const askStep = z
  .object({
    type: z.literal("ask"),
    field: z.string().trim().regex(/^[a-zA-Z_][a-zA-Z0-9_]{0,39}$/),
    prompt: text(300).min(1),
    fieldType: fieldType.default("text"),
    required: z.boolean().default(true),
  })
  .strip();

const toolStep = z
  .object({
    type: z.literal("tool"),
    toolName: text(80).min(1),
    argMap: z.record(z.string().trim().max(40), z.string().trim().max(40)).default({}),
  })
  .strip();

const sayStep = z
  .object({
    type: z.literal("say"),
    text: text(800).min(1),
  })
  .strip();

const handoffStep = z
  .object({
    type: z.literal("handoff"),
    reason: text(200).default("Customer needs a person for this procedure"),
  })
  .strip();

const endStep = z.object({ type: z.literal("end") }).strip();

export const procedureStepSchema = z.discriminatedUnion("type", [
  askStep,
  toolStep,
  sayStep,
  handoffStep,
  endStep,
]);

export const procedureSchema = z
  .object({
    id: z.string().trim().regex(/^[A-Za-z0-9_-]{1,40}$/),
    name: text(80).min(1),
    trigger: text(300).min(1),
    enabled: z.boolean().default(true),
    version: z.number().int().min(1).default(1),
    steps: z.array(procedureStepSchema).min(1).max(30),
  })
  .strip();

export const proceduresSchema = z
  .array(procedureSchema)
  .max(MAX_PROCEDURES)
  .refine((list) => new Set(list.map((p) => p.id)).size === list.length, "Procedure ids must be unique");

export function validateFieldValue(fieldTypeName, value) {
  const raw = String(value || "").trim();
  if (!raw) return { ok: false, error: "empty" };
  switch (fieldTypeName) {
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)
        ? { ok: true, value: raw.slice(0, 200) }
        : { ok: false, error: "invalid_email" };
    case "order_id":
      return /^[A-Za-z0-9_-]{4,40}$/.test(raw)
        ? { ok: true, value: raw }
        : { ok: false, error: "invalid_order_id" };
    case "number":
      return /^-?\d+(\.\d+)?$/.test(raw)
        ? { ok: true, value: raw.slice(0, 40) }
        : { ok: false, error: "invalid_number" };
    case "phone":
      return /^\+?[\d\s().-]{7,20}$/.test(raw)
        ? { ok: true, value: raw.slice(0, 30) }
        : { ok: false, error: "invalid_phone" };
    default:
      return { ok: true, value: raw.slice(0, 200) };
  }
}
