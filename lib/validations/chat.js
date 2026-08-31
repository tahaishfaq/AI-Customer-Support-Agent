import { z } from "zod";

const userSessionSchema = z
  .object({
    subject: z.string().trim().min(1).max(320).optional(),
    sub: z.string().trim().min(1).max(320).optional(),
    displayName: z.string().trim().max(200).optional(),
    name: z.string().trim().max(200).optional(),
    accessToken: z.string().trim().min(1).max(8192).optional(),
    token: z.string().trim().min(1).max(8192).optional(),
  })
  .refine(
    (v) =>
      Boolean(
        v.subject ||
          v.sub ||
          v.accessToken ||
          v.token
      ),
    { message: "userSession requires subject or accessToken" }
  );

export const chatMessageSchema = z
  .object({
    message: z.string().trim().min(1).optional(),
    /** F14-A — continue tool loop after user approved in UI (no fake user turn). */
    resumeAfterConfirmationId: z.string().trim().min(1).optional(),
    conversationId: z.string().trim().min(1).optional(),
    /** Owner-signed customer identity JWT (HS256). */
    identityToken: z.string().trim().min(1).max(8192).optional(),
    /** F14-C — host embed session (subject + optional access token). */
    userSession: userSessionSchema.optional(),
    /** Phase 1 — request SSE token stream (studio, no-tools path). */
    stream: z.boolean().optional(),
  })
  .refine(
    (v) => Boolean(v.message) || Boolean(v.resumeAfterConfirmationId),
    { message: "message or resumeAfterConfirmationId is required", path: ["message"] }
  );

export const listConversationsQuerySchema = z.object({
  agentId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export { zodErrorDetails } from "@/lib/validations/auth";
