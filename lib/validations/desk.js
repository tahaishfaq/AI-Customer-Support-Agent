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

export const inboxQuerySchema = z.object({
  status: z
    .enum(["WAITING_HUMAN", "OPEN", "RESOLVED", "ALL"])
    .optional()
    .default("WAITING_HUMAN"),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export { zodErrorDetails } from "@/lib/validations/auth";
