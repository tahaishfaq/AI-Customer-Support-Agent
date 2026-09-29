/**
 * Outcome of one AI reply, stored on the assistant message (Message.answerState) for resolution
 * metrics and the "unanswered questions" list. Pure; derived from signals the turn already has.
 */

export const ANSWER_STATES = Object.freeze({
  ANSWERED: "ANSWERED",
  NO_EVIDENCE: "NO_EVIDENCE",
  NOT_FOUND: "NOT_FOUND",
  HANDOFF: "HANDOFF",
  DEGRADED: "DEGRADED",
  /** Every data tool the reply needed failed (provider down, blocked URL, expired sign-in). */
  TOOL_FAILED: "TOOL_FAILED",
});

/** Replies that did not answer the customer's question. */
export const UNANSWERED_STATES = Object.freeze([ANSWER_STATES.NO_EVIDENCE, ANSWER_STATES.NOT_FOUND]);
/** A conversation whose last AI reply is one of these was not resolved by the AI. */
export const UNRESOLVED_STATES = Object.freeze([
  ANSWER_STATES.NO_EVIDENCE,
  ANSWER_STATES.NOT_FOUND,
  ANSWER_STATES.DEGRADED,
  ANSWER_STATES.HANDOFF,
  ANSWER_STATES.TOOL_FAILED,
]);

const FAILED_TOOL_STATUSES = new Set(["ERROR", "FAILED", "TIMEOUT", "SSRF_BLOCKED"]);

const STORE_ROUTES = new Set(["STORE", "MIXED"]);

/**
 * The reply says it could not answer ("I cannot provide…", "not specified in my knowledge",
 * "couldn't find", Roman Urdu "pata nahi"). The platform rules make the model use this wording
 * when business facts are missing, so it catches weak lexical knowledge matches that did not help.
 */
const CANNOT_ANSWER =
  /\b(i(?:'m| am) (?:sorry|afraid),? but i (?:can(?:no|')t|am unable|don'?t have)|i (?:can(?:no|')t|am unable to|could not|couldn'?t) (?:find|provide|verify|confirm|answer|share|locate|see)|i (?:don'?t|do not) have (?:[\w-]+ ){0,3}(?:information|details|data|knowledge)|not (?:specified|mentioned|covered|included|available) in (?:my|the|our) (?:knowledge|information|documents?|docs)|no (?:information|details) (?:about|on|regarding)|mujhe\b[^.?!]{0,40}\b(?:pata|maloom|ilm) nahi|i (?:can(?:no|')t|could not|couldn'?t|am unable to|was unable to) (?:retrieve|fetch|reach|access|get|load|connect)|i(?:'m| am) (?:unable|not able) to (?:retrieve|fetch|reach|access|get|load|find|provide)|\bmasla aa raha\b|(?:maloomat|information) (?:dastiyab|available) nahi)/i;
/** Urdu script has no ASCII word boundaries, so it is matched on its own. */
const CANNOT_ANSWER_URDU = /معلومات دستیاب نہیں|مجھے (?:معلوم|پتا|پتہ) نہیں/;

export function saysCannotAnswer(text) {
  const head = String(text || "").slice(0, 600);
  return CANNOT_ANSWER.test(head) || CANNOT_ANSWER_URDU.test(head);
}

/**
 * @param {{
 *   degraded?: boolean,
 *   handoff?: boolean,
 *   toolSteps?: Array<{ name?: string, status?: string, handoff?: { triggered?: boolean } }>,
 *   route?: string|null,
 *   usedKnowledgeCount?: number,
 *   searchUsed?: boolean,
 *   replyText?: string,
 * }} turn
 * @returns {keyof typeof ANSWER_STATES}
 */
export function deriveAnswerState(turn = {}) {
  if (turn.degraded) return ANSWER_STATES.DEGRADED;
  const steps = Array.isArray(turn.toolSteps) ? turn.toolSteps : [];
  if (turn.handoff || steps.some((step) => step?.handoff?.triggered)) return ANSWER_STATES.HANDOFF;

  const dataSteps = steps.filter((step) => step?.name !== "request_handoff" && step?.name !== "get_conversation_meta");
  const okStep = dataSteps.some((step) => String(step?.status || "").toUpperCase() === "OK");
  const notFound = dataSteps.some((step) => String(step?.status || "").toUpperCase() === "NO_RESULT");
  if (notFound && !okStep) return ANSWER_STATES.NOT_FOUND;
  const toolFailed = dataSteps.some((step) => FAILED_TOOL_STATUSES.has(String(step?.status || "").toUpperCase()));
  // The tools it needed all failed and nothing else answered (web or matching knowledge).
  if (toolFailed && !okStep && !turn.searchUsed && (!(Number(turn.usedKnowledgeCount) > 0) || saysCannotAnswer(turn.replyText))) {
    return ANSWER_STATES.TOOL_FAILED;
  }

  const knowledgeHit = Number(turn.usedKnowledgeCount) > 0;
  const storeRoute = STORE_ROUTES.has(String(turn.route || ""));
  if (storeRoute && !okStep && !turn.searchUsed && (!knowledgeHit || saysCannotAnswer(turn.replyText))) {
    return ANSWER_STATES.NO_EVIDENCE;
  }
  // Any route: a business question (knowledge matched) that the reply itself says it could not
  // answer. Off-topic refusals ("I cannot book flights") match no knowledge and stay ANSWERED.
  if (knowledgeHit && !okStep && !turn.searchUsed && saysCannotAnswer(turn.replyText)) return ANSWER_STATES.NO_EVIDENCE;
  return ANSWER_STATES.ANSWERED;
}
