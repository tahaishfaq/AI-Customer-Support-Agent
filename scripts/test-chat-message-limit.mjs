/**
 * Chat message length limit: typed text ≤ 4,000; a message with an attachment may carry up to
 * 8,000 extracted characters. Run: npm run test:chat-message-limit
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHAT_MESSAGE_MAX_CHARS,
  MESSAGE_TOO_LONG,
  chatMessageSchema,
  chatValidationError,
} from "../lib/validations/chat.js";
import { buildAttachmentMessage } from "../lib/utils/chat-attachments.js";

test("typed text: 4,000 ok, 4,001 rejected with a readable message and code", () => {
  assert.equal(chatMessageSchema.safeParse({ message: "a".repeat(CHAT_MESSAGE_MAX_CHARS) }).success, true);
  const parsed = chatMessageSchema.safeParse({ message: "a".repeat(CHAT_MESSAGE_MAX_CHARS + 1) });
  assert.equal(parsed.success, false);
  const invalid = chatValidationError(parsed.error);
  assert.match(invalid.message, /too long.*4,000/);
  assert.equal(invalid.details.code, MESSAGE_TOO_LONG);
  // Surrounding whitespace is trimmed before counting.
  assert.equal(chatMessageSchema.safeParse({ message: `  ${"a".repeat(CHAT_MESSAGE_MAX_CHARS)}  ` }).success, true);
});

test("attachments: full 8,000-char extract still accepted; oversized totals rejected", () => {
  const withFile = buildAttachmentMessage({ kind: "pdf", name: "guide.pdf", fileUrl: "https://res.cloudinary.com/x/guide.pdf", extracted: "x".repeat(9000) });
  assert.ok(withFile.length > CHAT_MESSAGE_MAX_CHARS, "attachment message is longer than the typed limit");
  assert.equal(chatMessageSchema.safeParse({ message: withFile }).success, true);
  assert.equal(chatMessageSchema.safeParse({ message: `${"a".repeat(4001)}\n\n${withFile}` }).success, false, "typed part still capped");
  assert.equal(chatMessageSchema.safeParse({ message: `hi <!--hapy-extract-->${"x".repeat(13000)}<!--/hapy-extract-->` }).success, false, "total cap");
});

test("other validation errors are unchanged", () => {
  const empty = chatMessageSchema.safeParse({ message: "" });
  assert.equal(empty.success, false);
  assert.equal(chatValidationError(empty.error).message, "Validation failed");
  assert.equal(chatMessageSchema.safeParse({ resumeAfterConfirmationId: "c1" }).success, true, "resume without message");
});
