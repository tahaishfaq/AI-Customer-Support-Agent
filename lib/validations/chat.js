import { z } from "zod";
import { parseChatAttachment } from "@/lib/utils/chat-attachments";
import { zodErrorDetails as baseZodErrorDetails } from "@/lib/validations/auth";

import { CHAT_MESSAGE_MAX_CHARS, CHAT_MESSAGE_MAX_TOTAL_CHARS } from "@/lib/chat/limits";

export { CHAT_MESSAGE_MAX_CHARS, CHAT_MESSAGE_MAX_TOTAL_CHARS };
export const MESSAGE_TOO_LONG = "MESSAGE_TOO_LONG";
const TOO_LONG_TEXT = `Message is too long — keep it under ${CHAT_MESSAGE_MAX_CHARS.toLocaleString("en-US")} characters.`;

/** Length check on the text the customer typed; an attached file's extracted text is capped separately. */
function messageTooLong(message) {
  if (typeof message !== "string") return false;
  if (message.length > CHAT_MESSAGE_MAX_TOTAL_CHARS) return true;
  return parseChatAttachment(message).display.length > CHAT_MESSAGE_MAX_CHARS;
}

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
    clientMessageId: z.string().trim().min(1).max(160).optional(),
    /** Owner-signed customer identity JWT (HS256). */
    identityToken: z.string().trim().min(1).max(8192).optional(),
    /** F14-C — host embed session (subject + optional access token). */
    userSession: userSessionSchema.optional(),
    /** Conversation-scoped capability returned by the first public chat response. */
    realtimeAccessToken: z.string().trim().min(1).max(4096).optional(),
    /** Phase 1 — request SSE token stream (studio, no-tools path). */
    stream: z.boolean().optional(),
    /** Level 2 · P5 — Studio only: try an unsaved prompt. Ignored on public routes. */
    draft: z.object({ systemPrompt: z.string().trim().min(1).max(20_000) }).strict().optional(),
  })
  .refine(
    (v) => Boolean(v.message) || Boolean(v.resumeAfterConfirmationId),
    { message: "message or resumeAfterConfirmationId is required", path: ["message"] }
  )
  .refine((v) => !messageTooLong(v.message), { message: TOO_LONG_TEXT, path: ["message"], params: { code: MESSAGE_TOO_LONG } });

export const listConversationsQuerySchema = z.object({
  agentId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const zodErrorDetails = baseZodErrorDetails;

/**
 * 400 body for an invalid chat request. A too-long message gets its own readable message and code
 * (shown in the widget); everything else stays "Validation failed".
 * @returns {{ message: string, details: Record<string, string> }}
 */
export function chatValidationError(error) {
  const details = baseZodErrorDetails(error);
  const tooLong = error.issues.some((issue) => issue.params?.code === MESSAGE_TOO_LONG);
  return tooLong
    ? { message: TOO_LONG_TEXT, details: { ...details, code: MESSAGE_TOO_LONG } }
    : { message: "Validation failed", details };
}
