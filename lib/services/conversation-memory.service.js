/**
 * Conversation memory (rolling summary). Runs in after() once a reply is sent: when enough
 * messages have left the 20-message history window, one tool-less LLM call folds them into
 * Conversation.memorySummary. Never blocks or fails a chat; nothing is logged but codes.
 */

import prisma from "@/lib/prisma";
import { chatCompletion } from "@/lib/services/ai/llm.provider";
import { MAX_HISTORY_MESSAGES } from "@/lib/services/ai/turn-context";
import { safeLogError } from "@/lib/observability/safe-log";
import { contentForLlm } from "@/lib/utils/chat-attachments";
import {
  MEMORY_MAX_BATCH,
  MEMORY_MIN_NEW_MESSAGES,
  MEMORY_TIMEOUT_MS,
  buildMemorySummaryPrompt,
  cleanMemorySummary,
  selectMessagesToSummarize,
} from "@/lib/chat/conversation-memory";

/**
 * @param {string} conversationId
 * @param {{ requestId?: string|null, windowSize?: number, complete?: typeof chatCompletion }} [opts]
 * @returns {Promise<"skipped"|"updated"|"raced"|"failed">}
 */
export async function refreshConversationMemory(conversationId, opts = {}) {
  const windowSize = opts.windowSize || MAX_HISTORY_MESSAGES;
  const complete = opts.complete || chatCompletion;
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { memorySummary: true, memorySummaryUpTo: true },
    });
    if (!conversation) return "skipped";

    // Newest window + one batch is all a single refresh can use; older rows were summarised before.
    const rows = await prisma.message.findMany({
      where: { conversationId, role: { not: "INTERNAL" } },
      orderBy: { createdAt: "desc" },
      take: windowSize + MEMORY_MAX_BATCH,
      select: { role: true, content: true, createdAt: true },
    });
    if (rows.length < windowSize + MEMORY_MIN_NEW_MESSAGES) return "skipped";
    const toFold = selectMessagesToSummarize(rows.reverse(), { windowSize, upTo: conversation.memorySummaryUpTo });
    if (!toFold) return "skipped";

    const prompt = buildMemorySummaryPrompt({
      previousSummary: conversation.memorySummary || "",
      messagesAsc: toFold.map((row) => ({ ...row, content: contentForLlm(row.content) })),
    });
    if (!prompt.lineCount) return "skipped";
    const { content } = await complete({ system: prompt.system, messages: prompt.messages, signal: AbortSignal.timeout(MEMORY_TIMEOUT_MS) });
    const summary = cleanMemorySummary(content);
    if (!summary) return "failed";

    // Optimistic guard: only the refresh that started from the stored cursor may write.
    const upTo = toFold[toFold.length - 1].createdAt;
    const result = await prisma.conversation.updateMany({
      where: { id: conversationId, memorySummaryUpTo: conversation.memorySummaryUpTo },
      data: { memorySummary: summary, memorySummaryUpTo: upTo },
    });
    return result.count === 1 ? "updated" : "raced";
  } catch (error) {
    safeLogError("conversation memory refresh failed", {
      requestId: opts.requestId || null,
      conversationId,
      code: error?.details?.code || error?.code || error?.status || "MEMORY_FAILED",
    });
    return "failed";
  }
}
