/**
 * Resolution metrics from per-conversation rows (pure). A conversation counts once it has
 * settled — no message for SETTLED_AFTER_MS — so chats still in progress never count as resolved.
 */

import { UNANSWERED_STATES, UNRESOLVED_STATES } from "./answer-state.js";

export const SETTLED_AFTER_MS = 24 * 60 * 60 * 1000;
export const UNANSWERED_TOP = 20;

const rate = (part, total) => (total > 0 ? Math.round((part / total) * 1000) / 10 : null);

/**
 * @param {Array<{
 *   id: string,
 *   status?: string,
 *   handoffCount?: number,
 *   humanHandled?: boolean,
 *   lastAt?: Date|string|null,
 *   userMessages?: number,
 *   lastAnswerState?: string|null,
 *   negativeFeedback?: boolean,
 *   csatScore?: number|null,
 * }>} rows customer-facing conversations in range
 * @param {{ now?: Date }} [opts]
 */
export function summarizeResolution(rows, { now = new Date() } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  const nowMs = now.getTime();
  let conversations = 0;
  let settled = 0;
  let tracked = 0;
  let aiResolved = 0;
  let handedOff = 0;
  let humanResolved = 0;
  let csatSum = 0;
  let csatCount = 0;

  for (const row of list) {
    if (!(Number(row?.userMessages) > 0)) continue; // greeting-only / empty chats are not support conversations
    conversations += 1;
    const handoff = Number(row.handoffCount) > 0;
    if (handoff) handedOff += 1;
    if (row.humanHandled) humanResolved += 1;
    if (Number.isFinite(row.csatScore) && row.csatScore >= 1 && row.csatScore <= 5) {
      csatSum += row.csatScore;
      csatCount += 1;
    }
    const lastMs = row.lastAt ? new Date(row.lastAt).getTime() : NaN;
    const isSettled = Number.isFinite(lastMs) && nowMs - lastMs >= SETTLED_AFTER_MS && row.status !== "WAITING_HUMAN";
    if (!isSettled) continue;
    settled += 1;
    // Only conversations whose last AI reply was tracked can be judged (older rows have no state).
    if (!row.lastAnswerState) continue;
    tracked += 1;
    if (!handoff && !row.negativeFeedback && !UNRESOLVED_STATES.includes(row.lastAnswerState)) aiResolved += 1;
  }

  return {
    conversations,
    settled,
    tracked,
    aiResolved,
    automationRate: rate(aiResolved, tracked),
    handedOff,
    handoffRate: rate(handedOff, conversations),
    humanResolved,
    csatAverage: csatCount ? Math.round((csatSum / csatCount) * 10) / 10 : null,
    csatCount,
  };
}

/** "  How do I RESET my password??  " → "how do i reset my password" (grouping key only). */
export function normalizeQuestion(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

/**
 * Customer questions the AI could not answer, grouped by normalized text, most frequent first.
 * @param {Array<{ question?: string, conversationId?: string, createdAt?: Date|string, state?: string }>} rows
 */
export function groupUnansweredQuestions(rows, { top = UNANSWERED_TOP } = {}) {
  const groups = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (row?.state && !UNANSWERED_STATES.includes(row.state)) continue;
    const key = normalizeQuestion(row?.question);
    if (key.length < 3) continue;
    const at = row.createdAt ? new Date(row.createdAt).getTime() : 0;
    const group = groups.get(key) || { question: String(row.question).trim().slice(0, 200), count: 0, lastAt: 0, conversationId: null, agentId: null };
    group.count += 1;
    if (at >= group.lastAt) {
      group.lastAt = at;
      group.conversationId = row.conversationId || group.conversationId;
      group.agentId = row.agentId || group.agentId;
      group.question = String(row.question).trim().slice(0, 200);
    }
    groups.set(key, group);
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || b.lastAt - a.lastAt)
    .slice(0, top)
    .map((group) => ({
      question: group.question,
      count: group.count,
      conversationId: group.conversationId,
      agentId: group.agentId,
      lastAt: group.lastAt ? new Date(group.lastAt).toISOString() : null,
    }));
}
