import { z } from "zod";

export const chatMessageSchema = z.object({
  message: z.string().trim().min(1, "Message is required"),
  conversationId: z.string().trim().min(1).optional(),
});

export const listConversationsQuerySchema = z.object({
  agentId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export { zodErrorDetails } from "@/lib/validations/auth";
