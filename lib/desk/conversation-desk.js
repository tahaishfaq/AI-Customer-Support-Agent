/**
 * F12 Human Desk — scope constants and identity guardrails (Phase A).
 * Handoff APIs and inbox UI build on these in later phases.
 */

import {
  DESK_HANDOFF_MAX_PER_CONVERSATION,
  DESK_HANDOFF_REOPEN_COOLDOWN_MS,
  DESK_HUMAN_TYPING_TTL_MS,
} from "./desk-config.js";

export const CONVERSATION_STATUS = {
  OPEN: "OPEN",
  WAITING_HUMAN: "WAITING_HUMAN",
  RESOLVED: "RESOLVED",
};

export const DESK_MESSAGE_ROLE = {
  HUMAN: "HUMAN",
};

/** Shown once when handoff starts (saved as ASSISTANT message). */
export const DESK_HANDOFF_ACK_MESSAGE =
  "Thanks for your patience — I'm connecting you with a human support agent. Please wait while someone joins this chat.";

/** Shown in embed after wait timeout with no human reply. */
export const DESK_WAIT_TIMEOUT_MESSAGE =
  "No one is available to assist you right now. Please leave your message here and we'll reply as soon as a team member is available.";

/** MVP: auto handoff when customer message matches. */
export const DEFAULT_HANDOFF_KEYWORDS = [
  "talk to human",
  "talk to a human",
  "talk to a person",
  "talk to person",
  "speak to human",
  "speak to a human",
  "speak to a person",
  "speak to person",
  "real person",
  "real agent",
  "live agent",
  "human agent",
  "not an agent",
  "not a bot",
  "not a robot",
  "speak to manager",
  "talk to manager",
  "refund dispute",
  "lawyer",
];

export function matchHandoffKeyword(text) {
  const lower = String(text || "").toLowerCase();
  if (!lower.trim()) return null;
  for (const phrase of DEFAULT_HANDOFF_KEYWORDS) {
    if (lower.includes(phrase)) {
      return { phrase, matched: phrase };
    }
  }
  return null;
}

export function isWaitingForHuman(conversation) {
  return conversation?.status === CONVERSATION_STATUS.WAITING_HUMAN;
}

export function isAiPaused(conversation) {
  return Boolean(conversation?.aiPaused) || isWaitingForHuman(conversation);
}

export function canTriggerHandoff(conversation) {
  return evaluateHandoffEligibility(conversation).ok;
}

/**
 * Per-conversation handoff rules:
 * - Max 3 requests total
 * - After a desk session ends (resolve / return to AI), wait 30 minutes
 */
export function evaluateHandoffEligibility(conversation, now = Date.now()) {
  const status = conversation?.status ?? CONVERSATION_STATUS.OPEN;
  const count = Number(conversation?.handoffCount || 0);
  const remaining = Math.max(0, DESK_HANDOFF_MAX_PER_CONVERSATION - count);

  if (status === CONVERSATION_STATUS.WAITING_HUMAN) {
    return {
      ok: false,
      code: "already_waiting",
      message: "A human is already joining this chat.",
      handoffCount: count,
      handoffRemaining: remaining,
      cooldownMs: 0,
      cooldownUntil: null,
    };
  }

  if (
    status !== CONVERSATION_STATUS.OPEN &&
    status !== CONVERSATION_STATUS.RESOLVED
  ) {
    return {
      ok: false,
      code: "unavailable",
      message: "Handoff is not available for this conversation.",
      handoffCount: count,
      handoffRemaining: remaining,
      cooldownMs: 0,
      cooldownUntil: null,
    };
  }

  if (count >= DESK_HANDOFF_MAX_PER_CONVERSATION) {
    return {
      ok: false,
      code: "limit_reached",
      message:
        "You have reached the limit of 3 human support requests for this chat. Please start a new chat if you still need help.",
      handoffCount: count,
      handoffRemaining: 0,
      cooldownMs: 0,
      cooldownUntil: null,
    };
  }

  // First request in this chat — no reopen cooldown.
  if (count === 0) {
    return {
      ok: true,
      code: "ok",
      message: null,
      handoffCount: count,
      handoffRemaining: remaining,
      cooldownMs: 0,
      cooldownUntil: null,
    };
  }

  const endedRaw =
    conversation?.lastHandoffEndedAt ||
    (status === CONVERSATION_STATUS.RESOLVED ? conversation?.endedAt : null);
  const endedAt = endedRaw ? new Date(endedRaw) : null;
  if (endedAt && !Number.isNaN(endedAt.getTime())) {
    const unlockAt = endedAt.getTime() + DESK_HANDOFF_REOPEN_COOLDOWN_MS;
    const cooldownMs = Math.max(0, unlockAt - now);
    if (cooldownMs > 0) {
      const minutes = Math.ceil(cooldownMs / 60_000);
      return {
        ok: false,
        code: "cooldown",
        message: `Please wait ${minutes} more minute${minutes === 1 ? "" : "s"} before requesting a human again (30 minutes after the last desk session closed).`,
        handoffCount: count,
        handoffRemaining: remaining,
        cooldownMs,
        cooldownUntil: new Date(unlockAt).toISOString(),
      };
    }
  }

  return {
    ok: true,
    code: "ok",
    message: null,
    handoffCount: count,
    handoffRemaining: remaining,
    cooldownMs: 0,
    cooldownUntil: null,
  };
}

/**
 * MVP desk agent = workspace owner (agent.userId). Multi-seat comes with P3-TEAMS.
 */
export function canActAsHuman({ userId, agent }) {
  if (!userId || !agent?.userId) return false;
  return userId === agent.userId;
}

/** Public/embed clients may only create USER messages — never HUMAN. */
export function isPublicMessageRole(role) {
  return role === "USER";
}

/** Owner inbox may send HUMAN; studio test chat stays USER/ASSISTANT only until Phase B APIs. */
export function isOwnerHumanMessageRole(role) {
  return role === DESK_MESSAGE_ROLE.HUMAN;
}

export function isHumanTypingRecently(
  humanTypingAt,
  ttlMs = DESK_HUMAN_TYPING_TTL_MS
) {
  if (!humanTypingAt) return false;
  const at =
    humanTypingAt instanceof Date ? humanTypingAt : new Date(humanTypingAt);
  if (Number.isNaN(at.getTime())) return false;
  return Date.now() - at.getTime() < ttlMs;
}

export function serializeDeskState(conversation) {
  if (!conversation) return null;
  const eligibility = evaluateHandoffEligibility(conversation);
  return {
    status: conversation.status ?? CONVERSATION_STATUS.OPEN,
    handoffReason: conversation.handoffReason ?? null,
    handoffSummary: conversation.handoffSummary ?? null,
    handoffAt: conversation.handoffAt ?? null,
    handoffCount: Number(conversation.handoffCount || 0),
    lastHandoffEndedAt: conversation.lastHandoffEndedAt ?? null,
    humanTypingAt: conversation.humanTypingAt ?? null,
    assignedUserId: conversation.assignedUserId ?? null,
    aiPaused: isAiPaused(conversation),
    waitingForHuman: isWaitingForHuman(conversation),
    handoffEligible: eligibility.ok,
    handoffRemaining: eligibility.handoffRemaining,
    handoffCooldownMs: eligibility.cooldownMs,
    handoffCooldownUntil: eligibility.cooldownUntil,
    handoffBlockCode: eligibility.ok ? null : eligibility.code,
    handoffBlockMessage: eligibility.ok ? null : eligibility.message,
  };
}
