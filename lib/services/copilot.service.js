/**
 * Level 2 · M4 — desk copilot. One LLM call, no tools, nothing stored: the draft or summary goes
 * back to the human only. Access is the desk guard (suggest = reply role, summary = read role).
 */

import prisma from "@/lib/prisma";
import { chatCompletion } from "@/lib/services/ai/llm.provider";
import { selectKnowledgeChunks } from "@/lib/services/ai/knowledge-retrieve";
import { chooseReplyLanguage } from "@/lib/services/ai/reply-language";
import { formatGuidanceBlock, selectGuidanceRules } from "@/lib/services/ai/guidance";
import { detectKnowledgeLanguage } from "@/lib/services/ai/turn-context";
import { assertDeskConversation } from "@/lib/services/handoff.service";
import { contentForLlm } from "@/lib/utils/chat-attachments";
import { safeLogError } from "@/lib/observability/safe-log";
import {
  COPILOT_HISTORY_LIMIT,
  COPILOT_KNOWLEDGE_CHARS,
  COPILOT_TIMEOUT_MS,
  buildCopilotTranscript,
  buildSuggestReplyPrompt,
  buildSummaryPrompt,
  cleanCopilotDraft,
  latestCustomerMessage,
} from "@/lib/desk/copilot";
import { loadKnowledgeDocsForRetrieval } from "@/lib/services/knowledge.service";

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

async function loadRecentMessages(conversationId) {
  const rows = await prisma.message.findMany({
    where: { conversationId, role: { not: "INTERNAL" } },
    orderBy: { createdAt: "desc" },
    take: COPILOT_HISTORY_LIMIT,
    select: { role: true, content: true },
  });
  return rows.map((row) => ({ role: row.role, content: contentForLlm(row.content) }));
}

/** One completion under the copilot deadline; the caller's abort (client gone) wins over the timeout. */
async function runCopilotCompletion({ system, messages, signal, kind, conversationId }) {
  const timeout = AbortSignal.timeout(COPILOT_TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
  try {
    const { content } = await chatCompletion({ system, messages, signal: combined });
    return content;
  } catch (error) {
    if (timeout.aborted && !signal?.aborted) {
      throw httpError(504, "The suggestion took too long. Try again.", { code: "COPILOT_TIMEOUT" });
    }
    if (error.status === 503 || error.status === 402 || error.status === 429 || error.status === 499) throw error;
    safeLogError("desk copilot failed", { code: error?.details?.code || error?.status || "COPILOT_FAILED", kind, conversationId });
    throw httpError(502, "Could not get a suggestion right now.", { code: "COPILOT_FAILED" });
  }
}

/** Draft the next human reply. Needs a desk role that can reply. */
export async function suggestDeskReply({ conversationId, userId, signal }) {
  const conversation = await assertDeskConversation(conversationId, userId, "reply");
  const [rows, agent, docs] = await Promise.all([
    loadRecentMessages(conversationId),
    prisma.agent.findUnique({
      where: { id: conversation.agentId },
      select: { name: true, systemPrompt: true, guidance: true },
    }),
    loadKnowledgeDocsForRetrieval(conversation.agentId, {
      select: {
        id: true,
        name: true,
        type: true,
        content: true,
        origin: true,
        sourceUrl: true,
        createdAt: true,
        agentId: true,
      },
    }),
  ]);

  const customerMessage = latestCustomerMessage(rows);
  const transcript = buildCopilotTranscript(rows);
  if (!customerMessage || !transcript.length) {
    throw httpError(409, "There is no customer message to reply to yet.", { code: "NOTHING_TO_SUGGEST" });
  }

  const knowledge = docs.length
    ? selectKnowledgeChunks({ docs, query: customerMessage, maxChars: COPILOT_KNOWLEDGE_CHARS, recentMessages: rows, allowSoftFallback: false })
    : { text: "", used: [] };
  const { language } = chooseReplyLanguage({
    message: customerMessage,
    history: rows,
    knowledgeLanguage: detectKnowledgeLanguage(docs),
  });
  const guidanceText = formatGuidanceBlock(selectGuidanceRules(agent?.guidance, customerMessage));

  const prompt = buildSuggestReplyPrompt({
    agentName: agent?.name,
    ownerPrompt: agent?.systemPrompt,
    guidanceText,
    knowledgeText: knowledge.text,
    language,
    transcript,
  });
  const content = await runCopilotCompletion({ ...prompt, signal, kind: "suggest", conversationId });
  const draft = cleanCopilotDraft(content);
  if (!draft) throw httpError(502, "Could not get a suggestion right now.", { code: "COPILOT_EMPTY" });

  return {
    draft,
    language,
    sources: (knowledge.used || []).slice(0, 5).map((doc) => ({ id: doc.id, name: doc.name })),
  };
}

/** Short summary for whoever picks the chat up. Any desk role that can read. */
export async function summarizeDeskConversation({ conversationId, userId, signal }) {
  await assertDeskConversation(conversationId, userId, "read");
  const transcript = buildCopilotTranscript(await loadRecentMessages(conversationId));
  if (!transcript.length) {
    throw httpError(409, "This conversation has no messages to summarise.", { code: "NOTHING_TO_SUMMARIZE" });
  }
  const content = await runCopilotCompletion({ ...buildSummaryPrompt({ transcript }), signal, kind: "summary", conversationId });
  const summary = String(content || "").trim().slice(0, 1_500);
  if (!summary) throw httpError(502, "Could not summarise right now.", { code: "COPILOT_EMPTY" });
  return { summary };
}
