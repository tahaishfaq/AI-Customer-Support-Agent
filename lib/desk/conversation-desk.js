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

export const HANDOFF_PRIORITY = {
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  URGENT: "URGENT",
};

export const DEFAULT_DESK_CANNED_REPLIES = Object.freeze([
  {
    id: "greeting",
    title: "Greeting",
    body: "Hi! Thanks for waiting — I'm here to help.",
  },
  {
    id: "looking",
    title: "Looking into it",
    body: "I'm looking into this for you now. I'll update you shortly.",
  },
  {
    id: "need_info",
    title: "Need more info",
    body: "Could you share a bit more detail so I can help faster?",
  },
  {
    id: "resolved",
    title: "Resolved",
    body: "That should be sorted now. Let me know if anything else comes up!",
  },
  {
    id: "followup",
    title: "Follow up",
    body: "Just checking in — is everything working as expected on your side?",
  },
]);

export function normalizeCannedReplies(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const cleaned = list
    .map((item, i) => ({
      id: String(item?.id || `canned_${i + 1}`).slice(0, 64),
      title: String(item?.title || "Reply").trim().slice(0, 80),
      body: String(item?.body || "").trim().slice(0, 2000),
    }))
    .filter((item) => item.body.length > 0)
    .slice(0, 12);
  return cleaned.length ? cleaned : [...DEFAULT_DESK_CANNED_REPLIES];
}

export const DESK_MESSAGE_ROLE = {
  HUMAN: "HUMAN",
  INTERNAL: "INTERNAL",
};

/** Roles safe to show on public embed / LLM context. */
export const CUSTOMER_VISIBLE_ROLES = Object.freeze(["USER", "ASSISTANT", "HUMAN"]);

export function isInternalNoteRole(role) {
  return role === DESK_MESSAGE_ROLE.INTERNAL;
}

export function isCustomerVisibleRole(role) {
  return CUSTOMER_VISIBLE_ROLES.includes(role);
}

/** Shown once when handoff starts (saved as ASSISTANT message). */
export const DESK_HANDOFF_ACK_MESSAGE =
  "Thanks for your patience — I'm connecting you with a human support agent. Please wait while someone joins this chat.";

/** Shown in embed after wait timeout with no human reply. */
export const DESK_WAIT_TIMEOUT_MESSAGE =
  "No one is available to assist you right now. Please leave your message here and we'll reply as soon as a team member is available.";

/**
 * Explicit ask for a person. First ask → AI tries + CTA.
 * Second ask in the same chat → connect to human.
 */
export const HUMAN_REQUEST_KEYWORDS = [
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
  "connect me to human",
  "connect me to a human",
  "i want a human",
];

/** Sensitive topics — AI must try first; never instant-handoff on first mention. */
export const SENSITIVE_TOPIC_KEYWORDS = ["refund dispute", "lawyer"];

/** Combined list (tests / docs). Instant handoff uses HUMAN_REQUEST_KEYWORDS only. */
export const DEFAULT_HANDOFF_KEYWORDS = [
  ...HUMAN_REQUEST_KEYWORDS,
  ...SENSITIVE_TOPIC_KEYWORDS,
];

export const NEED_HUMAN_MARKER = "[[NEED_HUMAN]]";

function includesPhrase(lower, phrase) {
  return lower.includes(phrase);
}

export function matchKeywordList(text, phrases) {
  const lower = String(text || "").toLowerCase();
  if (!lower.trim()) return null;
  for (const phrase of phrases) {
    if (includesPhrase(lower, phrase)) {
      return { phrase, matched: phrase };
    }
  }
  return null;
}

export function matchHumanRequest(text) {
  return matchKeywordList(text, HUMAN_REQUEST_KEYWORDS);
}

export function matchSensitiveTopic(text) {
  return matchKeywordList(text, SENSITIVE_TOPIC_KEYWORDS);
}

/** @deprecated use matchHumanRequest — kept for existing tests / call sites */
export function matchHandoffKeyword(text) {
  return matchHumanRequest(text);
}

export function countHumanRequestMessages(messages) {
  return (messages || []).filter(
    (m) => m.role === "USER" && matchHumanRequest(m.content)
  ).length;
}

export function conversationHasHumanRequest(messages) {
  return countHumanRequestMessages(messages) > 0;
}

export function parseNeedHumanMarker(text) {
  const raw = String(text || "");
  const needHuman = /\[\[\s*NEED_HUMAN\s*\]\]/i.test(raw);
  const content = raw.replace(/\[\[\s*NEED_HUMAN\s*\]\]/gi, "").trim();
  return {
    needHuman,
    content: content || (needHuman ? "" : raw.trim()),
  };
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

/** Public/embed clients may only create USER messages — never HUMAN or INTERNAL. */
export function isPublicMessageRole(role) {
  return role === "USER";
}

/** Owner inbox may send HUMAN replies to the customer. */
export function isOwnerHumanMessageRole(role) {
  return role === DESK_MESSAGE_ROLE.HUMAN;
}

/** Owner inbox may create INTERNAL notes (never customer-visible). */
export function isOwnerInternalNoteRole(role) {
  return role === DESK_MESSAGE_ROLE.INTERNAL;
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

export function isCsatPending(conversation) {
  if (!conversation?.lastHandoffEndedAt) return false;
  if (conversation.csatAt) return false;
  if (isWaitingForHuman(conversation)) return false;
  const ended = new Date(conversation.lastHandoffEndedAt).getTime();
  if (Number.isNaN(ended)) return false;
  // Do not resurface CSAT on ancient threads (e.g. pre-U5 history)
  const CSAT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - ended > CSAT_WINDOW_MS) return false;
  return true;
}

export function serializeDeskState(conversation) {
  if (!conversation) return null;
  const eligibility = evaluateHandoffEligibility(conversation);
  const csatScore =
    typeof conversation.csatScore === "number" &&
    conversation.csatScore >= 1 &&
    conversation.csatScore <= 5
      ? conversation.csatScore
      : null;
  return {
    status: conversation.status ?? CONVERSATION_STATUS.OPEN,
    handoffReason: conversation.handoffReason ?? null,
    handoffSummary: conversation.handoffSummary ?? null,
    handoffAt: conversation.handoffAt ?? null,
    handoffCount: Number(conversation.handoffCount || 0),
    lastHandoffEndedAt: conversation.lastHandoffEndedAt ?? null,
    humanTypingAt: conversation.humanTypingAt ?? null,
    assignedUserId: conversation.assignedUserId ?? null,
    assignedUserName: conversation.assignedUser?.name ?? null,
    claimedAt: conversation.claimedAt ?? null,
    handoffPriority: conversation.handoffPriority || HANDOFF_PRIORITY.NORMAL,
    csatScore,
    csatAt: conversation.csatAt ?? null,
    csatPending: isCsatPending(conversation),
    aiPaused: isAiPaused(conversation),
    waitingForHuman: isWaitingForHuman(conversation),
    claimedByMe: Boolean(
      conversation.claimedAt &&
        conversation.assignedUserId &&
        conversation._viewerUserId &&
        conversation.assignedUserId === conversation._viewerUserId
    ),
    claimedByOther: Boolean(
      conversation.claimedAt &&
        conversation.assignedUserId &&
        conversation._viewerUserId &&
        conversation.assignedUserId !== conversation._viewerUserId
    ),
    handoffEligible: eligibility.ok,
    handoffRemaining: eligibility.handoffRemaining,
    handoffCooldownMs: eligibility.cooldownMs,
    handoffCooldownUntil: eligibility.cooldownUntil,
    handoffBlockCode: eligibility.ok ? null : eligibility.code,
    handoffBlockMessage: eligibility.ok ? null : eligibility.message,
  };
}
