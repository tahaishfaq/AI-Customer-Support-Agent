import { z } from "zod";

export const handoffBodySchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const resolveBodySchema = z.object({
  resumeAi: z.boolean().optional().default(true),
});

export const humanMessageBodySchema = z.object({
  message: z.string().trim().min(1, "Message is required").max(8000),
});

export const internalNoteBodySchema = z.object({
  message: z.string().trim().min(1, "Note is required").max(8000),
});

export const inboxQuerySchema = z.object({
  status: z
    .enum(["WAITING_HUMAN", "OPEN", "RESOLVED", "ALL"])
    .optional()
    .default("WAITING_HUMAN"),
  priority: z.enum(["NORMAL", "HIGH", "URGENT", "ALL"]).optional().default("ALL"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const claimBodySchema = z.object({
  claim: z.boolean(),
});

export const deskPriorityBodySchema = z.object({
  priority: z.enum(["NORMAL", "HIGH", "URGENT"]),
});

export const cannedRepliesBodySchema = z.object({
  replies: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(64).optional(),
        title: z.string().trim().min(1).max(80),
        body: z.string().trim().min(1).max(2000),
      })
    )
    .max(12),
});

/** Public: optional 1–5 after desk resolve, or skip */
export const deskCsatBodySchema = z
  .object({
    score: z.coerce.number().int().min(1).max(5).optional(),
    skip: z.boolean().optional(),
  })
  .refine((v) => v.skip === true || (v.score != null && v.score >= 1 && v.score <= 5), {
    message: "Provide score (1–5) or skip: true",
  });

export { zodErrorDetails } from "@/lib/validations/auth";
