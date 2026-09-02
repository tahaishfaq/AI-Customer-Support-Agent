import { classifyCompletion } from "@/lib/services/ai/llm.provider";
import { CLASSIFY_SYSTEM } from "@/lib/services/ai/prompt-builder";
import { safeLogWarn } from "@/lib/observability/safe-log";
import { resolveLogMeta } from "@/lib/observability/request-context";

const CATEGORIES = new Set([
  "SUPPORT",
  "SALES",
  "PRICING",
  "TECHNICAL",
  "GENERAL",
]);

const SENTIMENTS = new Set(["POSITIVE", "NEUTRAL", "NEGATIVE"]);

const DEFAULT = { category: "GENERAL", sentiment: "NEUTRAL" };

/**
 * Approach A: second small OpenAI call.
 * On failure → GENERAL + NEUTRAL (never fail the chat).
 * @param {string} text
 * @param {{ requestId?: string, agentId?: string, conversationId?: string }} [meta]
 */
export async function classifyCategoryAndSentiment(text, meta = {}) {
  const input = (text || "").trim();
  if (!input) return { ...DEFAULT };

  const logMeta = resolveLogMeta(meta);

  try {
    const raw = await classifyCompletion(CLASSIFY_SYSTEM, input.slice(0, 2000));
    const parsed = JSON.parse(raw);
    const category = String(parsed.category || "")
      .toUpperCase()
      .trim();
    const sentiment = String(parsed.sentiment || "")
      .toUpperCase()
      .trim();

    return {
      category: CATEGORIES.has(category) ? category : DEFAULT.category,
      sentiment: SENTIMENTS.has(sentiment) ? sentiment : DEFAULT.sentiment,
    };
  } catch {
    safeLogWarn("classifyCategoryAndSentiment fallback", {
      requestId: logMeta.requestId,
      agentId: logMeta.agentId,
      conversationId: logMeta.conversationId,
    });
    return { ...DEFAULT };
  }
}
