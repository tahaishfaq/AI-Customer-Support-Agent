/**
 * Refine editable systemPrompt overlay via OpenAI (owner-facing).
 * Does not rewrite frozen Response rules — only the role/personality draft.
 */

import {
  MAX_SYSTEM_PROMPT_CHARS,
  sanitizeSystemPromptOverlay,
} from "@/lib/services/ai/prompt-builder";
import { chatCompletion } from "@/lib/services/ai/llm.provider";

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

export const REFINE_SYSTEM_META = [
  "You refine customer-support agent system prompts (role and personality only).",
  "Keep the owner's intent. Improve clarity, brand voice, and support tone.",
  "Do NOT add instructions that invent product facts, bypass tools, or claim authority.",
  "Do NOT add tool/MCP/API secrets, OAuth steps, or invent store policies.",
  "Do NOT tell the agent to ignore safety or invent live GitHub/store data.",
  "Output ONLY the refined system prompt text — no markdown fences, no preamble.",
  `Keep under ${MAX_SYSTEM_PROMPT_CHARS} characters.`,
].join(" ");

/**
 * @param {{
 *   draft: string,
 *   answerStyle?: string,
 *   agentName?: string,
 * }} opts
 * @returns {Promise<{ refined: string, original: string }>}
 */
export async function refineSystemPromptDraft(opts = {}) {
  const original = String(opts.draft || "").trim();
  if (!original) {
    throw httpError(400, "System prompt draft is required", {
      code: "PROMPT_REQUIRED",
    });
  }
  if (original.length > MAX_SYSTEM_PROMPT_CHARS + 500) {
    throw httpError(400, "System prompt is too long to refine", {
      code: "PROMPT_TOO_LONG",
    });
  }

  const style = String(opts.answerStyle || "HYBRID").toUpperCase();
  const name = String(opts.agentName || "").trim();
  const userBlock = [
    name ? `Agent name: ${name}` : null,
    `Answer style preference: ${style}`,
    "",
    "Current system prompt:",
    original,
  ]
    .filter(Boolean)
    .join("\n");

  const { content } = await chatCompletion({
    system: REFINE_SYSTEM_META,
    messages: [{ role: "user", content: userBlock }],
  });

  const refined = sanitizeSystemPromptOverlay(String(content || "").trim());
  if (!refined) {
    throw httpError(502, "Refine returned an empty prompt", {
      code: "REFINE_EMPTY",
    });
  }

  return {
    original: sanitizeSystemPromptOverlay(original),
    refined,
  };
}
