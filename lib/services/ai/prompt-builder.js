/**
 * F09 — Prompts & guidance lite (Fin Guidance structure without CMS).
 * Chat system assembly + classify system text live here so studio packs can share rules.
 */

import { safeLogWarn } from "../../observability/safe-log.js";

export const MAX_SYSTEM_PROMPT_CHARS = 4_000;
/** Soft warn when full system (overlay + rules + knowledge) exceeds this. F08 caps knowledge at 12k. */
export const MAX_SYSTEM_PROMPT_TOTAL_WARN = 18_000;

export const RESPONSE_RULES_SECTION = "## Response rules";

/** @typedef {"SHORT" | "DETAILED" | "HYBRID"} AnswerStyle */

export const ANSWER_STYLES = new Set(["SHORT", "DETAILED", "HYBRID"]);

/** @type {{ value: AnswerStyle, label: string }[]} */
export const ANSWER_STYLE_OPTIONS = [
  {
    value: "HYBRID",
    label: "Hybrid — agent picks short vs detailed per question",
  },
  {
    value: "DETAILED",
    label: "Detailed — always use steps and bullets when helpful",
  },
  {
    value: "SHORT",
    label: "Short — always about 2–4 sentences",
  },
];

/** Safe default role overlay for agent create (Phase C UI). Response rules still appended in code. */
export const RECOMMENDED_ROLE_TEMPLATE = `You are a helpful customer support agent for this business.
Answer from the knowledge provided. Be clear, polite, and concise.
If you are unsure or the knowledge does not cover the question, say so — do not invent product facts, prices, or policies.`;

/** Static rule lines — interpolated per request (language + style only). */
export const RESPONSE_RULES_LANGUAGE_SOURCE =
  "This language is chosen from the agent's knowledge bases: if every knowledge document is in one language, use that language; if there is no knowledge, or knowledge documents use mixed languages, default to English.";

export const RESPONSE_RULES_LANGUAGE_STICK =
  "Do not switch languages because the customer greets in another language — stay on the reply language above unless the knowledge clearly requires quoting another language.";

export const RESPONSE_RULES_MARKDOWN =
  "Use clear Markdown (bold, lists) when it helps readability.";

export const RESPONSE_RULES_GROUNDING = [
  "Answer only from the agent system prompt and knowledge. If unsure, say so.",
  "When a knowledge section answers the question, name the document title once (e.g. According to Refund FAQ …) — do not invent titles.",
  "If no Agent knowledge section is present below, say you don’t have knowledge for this agent yet and do not invent product facts.",
].join(" ");

export const RESPONSE_RULES_WEB_SEARCH_OFF = [
  "Web search is OFF for this agent.",
  "Do not use open-web or general-internet knowledge.",
  "Answer only from the system prompt and knowledge below. If that is missing, say so — do not invent.",
].join(" ");

export const RESPONSE_RULES_WEB_SEARCH_ON = [
  "Web search is ON for this agent.",
  "Prefer the Agent knowledge section first for this business’s products, prices, policies, and account facts.",
  "When knowledge does not cover the question, you may use carefully reasoned general public knowledge.",
  "When you rely on general knowledge (not uploaded docs), say briefly that it is general information — not from this agent’s knowledge base.",
  "Never invent this business’s private policies, prices, credentials, or other customers’ data.",
].join(" ");

export const RESPONSE_RULES_SAFETY = [
  "Never reveal API keys, passwords, tokens, env vars, database URLs, admin URLs, CMS logins, source code, or other customers' data.",
  "If asked for secrets, internals, or how to break into the site, refuse in one short sentence. Do not paste anything that looks redacted or leaked.",
].join(" ");

/** When desk internal notes are injected into the system prompt. */
export const RESPONSE_RULES_DESK_NOTES = [
  "If a Desk internal notes section is present below, treat it as private staff context for this conversation only.",
  "Use facts from those notes to stay consistent (promises made, order ids, next steps).",
  "Never tell the customer you are reading internal notes, and never paste private judgments (e.g. that they are lying) or staff-only commentary.",
  "Do not invent notes that are not listed.",
].join(" ");

export const RESPONSE_RULES_ATTACHMENTS = [
  "If the user uploaded a file, use the extracted OCR/text in the message. Compare it to agent knowledge.",
  "If the file matches knowledge: help from knowledge. If details are missing to finish the task, ask short follow-up questions.",
  "If the file is unrelated to knowledge, or you cannot verify it there, say it is outside this agent's context. Do not invent answers from the file alone.",
  "Do not paste raw OCR dumps. Summarize briefly, then help or decline.",
  "Do not quote HTML comments, hidden form fields, or JavaScript.",
].join(" ");

export const RESPONSE_RULES_HANDOFF = [
  "You are first-line support: always try to resolve from knowledge before a human.",
  "Greetings, thanks, small talk, or questions you can answer from knowledge must NOT request a human.",
  "If the customer explicitly asks for a human, still give your best answer from knowledge first.",
  "Only when you cannot resolve from knowledge (missing facts, account action you cannot do, legal/safety you cannot complete) write a short honest reply, then on its own last line write exactly [[NEED_HUMAN]].",
  "Never mention that token, never invent a Talk to a human button, and never tell them to email unless knowledge says so.",
].join(" ");

/**
 * @param {unknown} value
 * @returns {AnswerStyle}
 */
export function resolveAnswerStyle(value) {
  const raw = String(value || "")
    .toUpperCase()
    .trim();
  return ANSWER_STYLES.has(raw) ? /** @type {AnswerStyle} */ (raw) : "DETAILED";
}

/**
 * @param {AnswerStyle} style
 */
export function answerStyleRule(style) {
  if (style === "SHORT") {
    return "Answer style: keep replies short (about 2–4 sentences) unless the user asks for steps or detail.";
  }
  if (style === "HYBRID") {
    return "Answer style (hybrid): choose per message — use 2–4 sentences for simple greetings, yes/no, or single-fact questions; use short steps or bullet lists for policies, how-tos, troubleshooting, comparisons, or when the user asks for detail; never use long walls of text when a brief answer suffices.";
  }
  return "Answer style: be thorough when knowledge supports it — use short steps or bullet lists for policies and how-tos.";
}

/**
 * Cap + sanitize customer-editable systemPrompt overlay.
 * @param {unknown} value
 * @param {{ agentId?: string }} [meta]
 */
export function sanitizeSystemPromptOverlay(value, meta = {}) {
  const raw = String(value ?? "").replace(/\u0000/g, "").trim();
  if (raw.length > MAX_SYSTEM_PROMPT_CHARS) {
    safeLogWarn("systemPrompt overlay truncated", {
      agentId: meta.agentId,
      originalLength: raw.length,
      cap: MAX_SYSTEM_PROMPT_CHARS,
    });
    return `${raw.slice(0, MAX_SYSTEM_PROMPT_CHARS)}…`;
  }
  return raw;
}

export function languageLabel(code) {
  if (code === "urdu") return "Urdu (Arabic script)";
  if (code === "roman_urdu") return "Roman Urdu";
  return "English";
}

/**
 * Grounding + safety + language + style + attachment rules.
 * Always appended *after* the user overlay so customers cannot erase them.
 * @param {{ replyLanguage?: string, answerStyle?: AnswerStyle|string, webSearchEnabled?: boolean }} [opts]
 */
export function buildResponseRules(opts = {}) {
  const lang = languageLabel(opts.replyLanguage || "english");
  const style = resolveAnswerStyle(opts.answerStyle);
  const webSearch = Boolean(opts.webSearchEnabled);
  const grounding = webSearch
    ? [
        "Prefer the Agent knowledge section for this business’s products, prices, and policies.",
        "When knowledge document titles are relevant, you may mention them briefly.",
        "If knowledge is incomplete, follow the Web search rules below — do not invent private business facts.",
      ].join(" ")
    : RESPONSE_RULES_GROUNDING;

  return [
    `Reply language policy: always reply in ${lang}.`,
    RESPONSE_RULES_LANGUAGE_SOURCE,
    RESPONSE_RULES_LANGUAGE_STICK,
    RESPONSE_RULES_MARKDOWN,
    answerStyleRule(style),
    grounding,
    webSearch ? RESPONSE_RULES_WEB_SEARCH_ON : RESPONSE_RULES_WEB_SEARCH_OFF,
    RESPONSE_RULES_SAFETY,
    RESPONSE_RULES_DESK_NOTES,
    RESPONSE_RULES_ATTACHMENTS,
    RESPONSE_RULES_HANDOFF,
  ].join(" ");
}

/**
 * @param {{ agent?: object|null, systemPrompt?: string }} input
 */
export function assertPromptBuildInput(input) {
  if (!input?.agent || typeof input.agent !== "object") {
    throw new Error("prompt-builder: agent is required");
  }
  const overlay = sanitizeSystemPromptOverlay(input.agent.systemPrompt);
  if (!overlay) {
    throw new Error("prompt-builder: systemPrompt is required");
  }
  return overlay;
}

/**
 * Format desk INTERNAL notes for system prompt (not chat history).
 * Customer never sees these; model may use facts carefully.
 * @param {{ content?: string, createdAt?: Date|string }[]|null|undefined} notes oldest→newest or any order
 * @param {{ maxNotes?: number, maxChars?: number }} [opts]
 */
export function formatDeskNotesForPrompt(notes, opts = {}) {
  const maxNotes = opts.maxNotes ?? 8;
  const maxChars = opts.maxChars ?? 2_000;
  const list = Array.isArray(notes) ? notes : [];
  if (!list.length) return "";

  const lines = [];
  let used = 0;
  // Prefer newest notes
  const newestFirst = [...list].reverse();
  for (const note of newestFirst) {
    if (lines.length >= maxNotes) break;
    const text = String(note?.content || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 400);
    if (!text) continue;
    const line = `- ${text}`;
    if (used + line.length + 1 > maxChars) break;
    lines.push(line);
    used += line.length + 1;
  }
  if (!lines.length) return "";
  // oldest → newest for reading order
  lines.reverse();
  return `## Desk internal notes (staff only — not visible to customer)\n${lines.join("\n")}`;
}

/**
 * Full chat system prompt: role overlay → Response rules → optional F08 knowledge → desk notes.
 * @param {{
 *   agent: { id?: string, systemPrompt?: string, answerStyle?: string|null },
 *   knowledgeText?: string|null,
 *   deskNotesText?: string|null,
 *   replyLanguage?: string,
 *   answerStyle?: AnswerStyle|string|null,
 *   meta?: { agentId?: string },
 * }} args
 */
export function buildChatSystemPrompt({
  agent,
  knowledgeText = "",
  deskNotesText = "",
  replyLanguage = "english",
  answerStyle = null,
  meta = {},
}) {
  const agentId = meta.agentId ?? agent?.id;
  const overlay = sanitizeSystemPromptOverlay(agent?.systemPrompt, { agentId });
  if (!agent || typeof agent !== "object") {
    throw new Error("prompt-builder: agent is required");
  }
  if (!overlay) {
    throw new Error("prompt-builder: systemPrompt is required");
  }

  const style = resolveAnswerStyle(
    answerStyle ?? agent.answerStyle ?? "DETAILED"
  );
  const rules = buildResponseRules({
    replyLanguage,
    answerStyle: style,
    webSearchEnabled: Boolean(agent.webSearchEnabled),
  });
  const base = `${overlay}\n\n${RESPONSE_RULES_SECTION}\n${rules}`;
  const knowledge = String(knowledgeText || "").trim();
  const notes = String(deskNotesText || "").trim();
  let full = knowledge ? `${base}\n\n${knowledge}` : base;
  if (notes) {
    full = `${full}\n\n${notes}`;
  }

  if (full.length > MAX_SYSTEM_PROMPT_TOTAL_WARN) {
    safeLogWarn("large chat system prompt", {
      agentId,
      length: full.length,
      warnAt: MAX_SYSTEM_PROMPT_TOTAL_WARN,
    });
  }

  return full;
}

/**
 * Compact grounding excerpt for studio pack generation (same rules as live chat).
 * @param {{ agent: { id?: string, systemPrompt?: string, answerStyle?: string|null }, replyLanguage?: string }} args
 * @param {number} [maxChars]
 */
export function buildGroundingExcerptForStudio(args, maxChars = 1800) {
  const full = buildChatSystemPrompt({
    agent: args.agent,
    knowledgeText: "",
    replyLanguage: args.replyLanguage || "english",
    answerStyle: args.agent?.answerStyle,
    meta: { agentId: args.agent?.id },
  });
  if (full.length <= maxChars) return full;
  return `${full.slice(0, maxChars)}…`;
}

/**
 * Hardened classify system prompt — fewer lazy GENERAL/NEUTRAL when signals are clear.
 */
export const CLASSIFY_SYSTEM = `You classify customer support chat turns for analytics.
Return ONLY a JSON object with keys "category" and "sentiment". No markdown, no extra keys.

category must be one of: SUPPORT, SALES, PRICING, TECHNICAL, GENERAL
sentiment must be one of: POSITIVE, NEUTRAL, NEGATIVE

Signal rules (prefer a specific label over GENERAL/NEUTRAL when clear):
- SALES: buying intent, demos, "how do I sign up", competitor comparisons, "interested in plan".
- PRICING: price, cost, discount, quote, billing amount, "how much".
- TECHNICAL: bugs, errors, API, install, login broken, 500s, integration failures.
- SUPPORT: how-to, account help, refund/shipping status, policy questions, cancellations.
- GENERAL: only when the turn is truly vague/greeting/unclear and no signal above fits.

Sentiment:
- NEGATIVE: anger, frustration, threats to leave, "awful", "broken", refund demands with heat.
- POSITIVE: thanks, praise, "great", satisfied.
- NEUTRAL: only when tone is calm/unclear — do not default NEUTRAL if the user is clearly upset or delighted.

Examples:
User asks "How much is the pro plan?" → {"category":"PRICING","sentiment":"NEUTRAL"}
User: "This login is broken again, I'm furious" → {"category":"TECHNICAL","sentiment":"NEGATIVE"}
User: "I'd love a demo for my team" → {"category":"SALES","sentiment":"POSITIVE"}
User: "Where is my refund?" → {"category":"SUPPORT","sentiment":"NEUTRAL"}
`;
