import { classifyCompletion } from "@/lib/services/ai/llm.provider";

const CATEGORIES = new Set([
  "SUPPORT",
  "SALES",
  "PRICING",
  "TECHNICAL",
  "GENERAL",
]);

const SENTIMENTS = new Set(["POSITIVE", "NEUTRAL", "NEGATIVE"]);

const DEFAULT = { category: "GENERAL", sentiment: "NEUTRAL" };

const SYSTEM = `You classify customer support chat turns.
Return ONLY a JSON object with keys "category" and "sentiment".
category must be one of: SUPPORT, SALES, PRICING, TECHNICAL, GENERAL
sentiment must be one of: POSITIVE, NEUTRAL, NEGATIVE`;

/**
 * Approach A: second small OpenAI call.
 * On failure → GENERAL + NEUTRAL (never fail the chat).
 */
export async function classifyCategoryAndSentiment(text) {
  const input = (text || "").trim();
  if (!input) return { ...DEFAULT };

  try {
    const raw = await classifyCompletion(SYSTEM, input.slice(0, 2000));
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
  } catch (error) {
    console.error("classifyCategoryAndSentiment fallback", error?.message || error);
    return { ...DEFAULT };
  }
}
