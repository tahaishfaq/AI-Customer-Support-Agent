/**
 * B4 — answer first, hand off second. Pure rules the orchestrator loop uses when the model batches
 * request_handoff with other tools. A deferred handoff changes no desk state; explicit human asks
 * and a handoff requested on its own are never deferred.
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

/**
 * The model batched request_handoff with other tools although the customer did not ask for a
 * person: answer from the other results first, offer the human after (B4).
 */
export function shouldDeferHandoff(calls, byName, lastUserMessage) {
  const list = Array.isArray(calls) ? calls : [];
  const handoffs = list.filter((call) => isHandoffCall(call, byName)).length;
  return handoffs > 0 && handoffs < list.length && !asksForHuman(lastUserMessage);
}
