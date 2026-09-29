/**
 * Level 2 · M2 — reply outcome (answerState) and resolution metrics.
 * Run: npm run test:resolution-metrics
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ANSWER_STATES, deriveAnswerState, saysCannotAnswer } from "../lib/analytics/answer-state.js";
import {
  SETTLED_AFTER_MS,
  groupUnansweredQuestions,
  normalizeQuestion,
  summarizeResolution,
} from "../lib/analytics/resolution.js";

const NOW = new Date("2026-09-29T12:00:00Z");
const settledAt = new Date(NOW.getTime() - SETTLED_AFTER_MS - 1000);
const activeAt = new Date(NOW.getTime() - 60_000);

test("answer state: priority DEGRADED > HANDOFF > NOT_FOUND > NO_EVIDENCE > ANSWERED", () => {
  assert.equal(deriveAnswerState({ degraded: true, handoff: true }), ANSWER_STATES.DEGRADED);
  assert.equal(deriveAnswerState({ handoff: true }), ANSWER_STATES.HANDOFF);
  assert.equal(deriveAnswerState({ toolSteps: [{ name: "request_handoff", status: "OK", handoff: { triggered: true } }] }), ANSWER_STATES.HANDOFF);
  assert.equal(deriveAnswerState({ toolSteps: [{ name: "get_campaign", status: "NO_RESULT" }] }), ANSWER_STATES.NOT_FOUND);
  // One tool found nothing, another answered → answered.
  assert.equal(deriveAnswerState({ toolSteps: [{ name: "a", status: "NO_RESULT" }, { name: "b", status: "OK" }] }), ANSWER_STATES.ANSWERED);
  assert.equal(deriveAnswerState({ route: "STORE", usedKnowledgeCount: 0 }), ANSWER_STATES.NO_EVIDENCE);
  assert.equal(deriveAnswerState({ route: "MIXED", usedKnowledgeCount: 0, searchUsed: false }), ANSWER_STATES.NO_EVIDENCE);
  assert.equal(deriveAnswerState({ route: "STORE", usedKnowledgeCount: 2 }), ANSWER_STATES.ANSWERED);
  assert.equal(deriveAnswerState({ route: "MIXED", searchUsed: true }), ANSWER_STATES.ANSWERED);
  assert.equal(deriveAnswerState({ route: "STORE", toolSteps: [{ name: "list_plans", status: "OK" }] }), ANSWER_STATES.ANSWERED);
  // General questions answered from general knowledge are answers, not gaps.
  assert.equal(deriveAnswerState({ route: "GENERAL", usedKnowledgeCount: 0 }), ANSWER_STATES.ANSWERED);
  // Meta/handoff built-ins are not evidence.
  assert.equal(deriveAnswerState({ route: "STORE", toolSteps: [{ name: "get_conversation_meta", status: "OK" }] }), ANSWER_STATES.NO_EVIDENCE);
  assert.equal(deriveAnswerState(), ANSWER_STATES.ANSWERED);
});

const row = (overrides) => ({
  id: "c",
  status: "OPEN",
  handoffCount: 0,
  humanHandled: false,
  lastAt: settledAt,
  userMessages: 2,
  lastAnswerState: "ANSWERED",
  negativeFeedback: false,
  csatScore: null,
  ...overrides,
});

test("resolution: only settled, tracked chats with a question count; each exclusion applies", () => {
  const rows = [
    row({ id: "ai1" }),
    row({ id: "ai2" }),
    row({ id: "noEvidence", lastAnswerState: "NO_EVIDENCE" }),
    row({ id: "notFound", lastAnswerState: "NOT_FOUND" }),
    row({ id: "thumbsDown", negativeFeedback: true }),
    row({ id: "handoff", handoffCount: 1, humanHandled: true, lastAnswerState: "HANDOFF", csatScore: 4 }),
    row({ id: "active", lastAt: activeAt }), // still in progress
    row({ id: "waiting", status: "WAITING_HUMAN", handoffCount: 1 }), // waiting for a human
    row({ id: "untracked", lastAnswerState: null }), // before the migration
    row({ id: "greetingOnly", userMessages: 0 }), // no customer question
  ];
  const summary = summarizeResolution(rows, { now: NOW });
  assert.equal(summary.conversations, 9, "greeting-only excluded");
  assert.equal(summary.settled, 7, "active + waiting not settled");
  assert.equal(summary.tracked, 6, "untracked excluded from the rate");
  assert.equal(summary.aiResolved, 2);
  assert.equal(summary.automationRate, 33.3);
  assert.equal(summary.handedOff, 2);
  assert.equal(summary.handoffRate, 22.2);
  assert.equal(summary.humanResolved, 1);
  assert.equal(summary.csatAverage, 4);
  assert.equal(summary.csatCount, 1);
});

test("resolution: empty and junk input never divide by zero", () => {
  const empty = summarizeResolution([], { now: NOW });
  assert.equal(empty.automationRate, null);
  assert.equal(empty.handoffRate, null);
  assert.equal(empty.csatAverage, null);
  assert.doesNotThrow(() => summarizeResolution(null));
  assert.doesNotThrow(() => summarizeResolution([{}, { userMessages: 1, lastAt: "not a date" }]));
  assert.equal(summarizeResolution([row({ csatScore: 9 }), row({ csatScore: 0 })], { now: NOW }).csatCount, 0, "out-of-range ratings ignored");
});

test("unanswered questions: grouped, counted, newest link kept, top N", () => {
  assert.equal(normalizeQuestion("  How do I RESET my password??  "), "how do i reset my password");
  assert.equal(normalizeQuestion("Mera refund kab aayega? https://x.y/z"), "mera refund kab aayega");
  const rows = [
    { question: "How do I reset my password?", conversationId: "c1", agentId: "a", createdAt: "2026-09-20T00:00:00Z", state: "NO_EVIDENCE" },
    { question: "how do i reset my PASSWORD", conversationId: "c2", agentId: "a", createdAt: "2026-09-25T00:00:00Z", state: "NO_EVIDENCE" },
    { question: "Where is order A12345?", conversationId: "c3", agentId: "b", createdAt: "2026-09-26T00:00:00Z", state: "NOT_FOUND" },
    { question: "ok", conversationId: "c4", createdAt: "2026-09-26T00:00:00Z", state: "NO_EVIDENCE" }, // too short
    { question: "ignored answered", conversationId: "c5", state: "ANSWERED" },
    { question: "", conversationId: "c6", state: "NO_EVIDENCE" },
  ];
  const grouped = groupUnansweredQuestions(rows);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].count, 2);
  assert.equal(grouped[0].conversationId, "c2", "newest occurrence is linked");
  assert.equal(grouped[0].agentId, "a");
  assert.equal(grouped[1].question, "Where is order A12345?");
  const many = Array.from({ length: 30 }, (_, i) => ({ question: `question number ${i}`, conversationId: `c${i}`, state: "NO_EVIDENCE" }));
  assert.equal(groupUnansweredQuestions(many).length, 20);
  assert.deepEqual(groupUnansweredQuestions(null), []);
});

test("a weak knowledge hit that did not help: the reply says it cannot answer", () => {
  const refusal = "I'm sorry, but I cannot provide information about the return policy for international furniture orders, as it is not specified in my knowledge.";
  assert.equal(deriveAnswerState({ route: "STORE", usedKnowledgeCount: 1, replyText: refusal }), ANSWER_STATES.NO_EVIDENCE);
  assert.equal(deriveAnswerState({ route: "STORE", usedKnowledgeCount: 1, replyText: "Returns are accepted within 30 days." }), ANSWER_STATES.ANSWERED);
  // A tool that answered wins over refusal wording (e.g. "I can't share X, but your order shipped").
  assert.equal(deriveAnswerState({ route: "STORE", usedKnowledgeCount: 1, replyText: refusal, toolSteps: [{ name: "get_order", status: "OK" }] }), ANSWER_STATES.ANSWERED);
  // General questions (unsupported capability) are not knowledge gaps.
  assert.equal(deriveAnswerState({ route: "GENERAL", replyText: "I'm sorry, but I cannot book flights." }), ANSWER_STATES.ANSWERED);
  for (const text of [
    "I don't have enough verified AIDE information to answer that.",
    "I couldn't find anything about that in our documents.",
    "Mujhe aapka refund status pata nahi hai.",
    "There is no information about furniture shipping.",
  ]) assert.equal(saysCannotAnswer(text), true, text);
  for (const text of ["You can reset your password from Settings.", "We don't have a Pro Max plan, but Pro includes team seats.", "", null]) {
    assert.equal(saysCannotAnswer(text), false, String(text));
  }
});
