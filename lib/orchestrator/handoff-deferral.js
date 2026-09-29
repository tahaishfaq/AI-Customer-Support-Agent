/**
 * B4 — answer first, hand off second. Pure rules the orchestrator loop uses when the model asks for
 * request_handoff although the customer did not ask for a person. A deferred handoff changes no desk
 * state; the reply offers the team (handoff button) instead.
 *
 * Never deferred: the customer asked for a person, or said yes to the team offer in the previous
 * reply. A handoff requested on its own is deferred at most once per turn (the model may insist).
 */

import { matchHumanRequest } from "../desk/conversation-desk.js";

export const HANDOFF_TOOL = "request_handoff";
export const DEFERRED_HANDOFF_RESULT = JSON.stringify({
  ok: false,
  status: "deferred",
  message:
    "Handoff not started yet. Answer everything you can from the other tool results and knowledge first, then offer to connect the customer with the team for anything still unresolved.",
});

export function isHandoffCall(call, byName) {
  const name = String(call?.function?.name || "");
  return name === HANDOFF_TOOL || byName?.get?.(name)?._builtin?.id === HANDOFF_TOOL;
}

/** Customer asked for a person in this message (desk keywords, or a connect/talk verb + person noun). */
export function asksForHuman(text) {
  const t = String(text || "").toLowerCase();
  if (!t.trim()) return false;
  if (matchHumanRequest(t)) return true;
  return (
    /\b(talk|speak|connect|transfer|escalate|chat|put me through|hand me over)\b/.test(t) &&
    /\b(human|person|people|someone|agent|representative|rep|staff|team member|your team|support team|manager)\b/.test(t)
  );
}

/** The previous AI reply offered a person ("connect you with our team", "team se rabta"). */
export function offeredHuman(text) {
  const t = String(text || "").toLowerCase();
  if (!t.trim()) return false;
  return (
    /\b(connect|transfer|hand (?:you )?over|put you through|escalate)\b[^.?!]{0,60}\b(team|human|person|someone|agent|colleague|staff|representative|support)\b/.test(t) ||
    /\b(team|insaan|agent)\b[^.?!]{0,30}\b(se )?(baat|rabta|connect|jor|jod)\b/.test(t)
  );
}

/** Short yes to an offer: "yes", "yes please", "sure", "haan ji", "theek hai", "please do". */
export function isShortYes(text) {
  const t = String(text || "").trim().toLowerCase().replace(/[.!?]+$/g, "");
  if (!t || t.split(/\s+/).length > 6) return false;
  return /^(yes|yeah|yep|yup|sure|ok|okay|please|please do|go ahead|haan|han|ji|jee|g|theek hai|thik hai|zaroor|bilkul)\b/.test(t);
}

/**
 * @param {Array} calls tool calls of this model turn
 * @param {Map} byName
 * @param {string|null} lastUserMessage
 * @param {{ previousAssistant?: string|null, alreadyDeferred?: boolean }} [context]
 */
export function shouldDeferHandoff(calls, byName, lastUserMessage, context = {}) {
  const list = Array.isArray(calls) ? calls : [];
  const handoffs = list.filter((call) => isHandoffCall(call, byName)).length;
  if (!handoffs || asksForHuman(lastUserMessage)) return false;
  // "Yes" to "Shall I connect you with our team?" is a request for a person.
  if (isShortYes(lastUserMessage) && offeredHuman(context.previousAssistant)) return false;
  // Batched with other tools: answer from them first (every time, as before).
  if (handoffs < list.length) return true;
  // On its own: defer once, so the reply offers the team; if the model insists, let it through.
  return !context.alreadyDeferred;
}

/** Text of the last assistant message in the history (the reply before this customer message). */
export function previousAssistantText(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const message = list[i];
    if (message?.role === "assistant" && typeof message.content === "string" && message.content.trim()) {
      return message.content;
    }
  }
  return "";
}
