/**
 * Stage 5.3 — Server-side authorization binding (user → tenant/agent → conversation → resource).
 * Complements phrase heuristics in detectCrossUserRequest.
 */

const IDENTITY_ARG_KEYS = Object.freeze([
  "userId",
  "user_id",
  "customerId",
  "customer_id",
  "accountId",
  "account_id",
  "memberId",
  "member_id",
  "patientId",
  "patient_id",
  "ownerId",
  "owner_id",
]);

const EMAIL_ARG_KEYS = Object.freeze(["email", "userEmail", "customerEmail"]);
const PHONE_ARG_KEYS = Object.freeze(["phone", "mobile", "userPhone"]);

function firstString(obj, keys) {
  if (!obj || typeof obj !== "object") return "";
  for (const k of keys) {
    const v = obj[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 7 ? digits : "";
}

/**
 * Pull identity-like fields from tool args (never uses args.subject — ticket titles).
 * @param {object|null|undefined} args
 */
export function extractIdentityArgs(args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return { userId: "", email: "", phone: "" };
  }
  return {
    userId: firstString(args, IDENTITY_ARG_KEYS),
    email: firstString(args, EMAIL_ARG_KEYS).toLowerCase(),
    phone: normalizePhone(firstString(args, PHONE_ARG_KEYS)),
  };
}

/**
 * Hard resource binding: tool args must not target a different user than the
 * trusted conversation subject / claims.
 *
 * @param {{
 *   toolArgs?: object|null,
 *   customerSubject?: string|null,
 *   customerClaims?: { email?: string|null, phone?: string|null }|null,
 *   publicAccess?: boolean,
 * }} opts
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export function assertResourceSubjectBinding(opts = {}) {
  const {
    toolArgs = null,
    customerSubject = null,
    customerClaims = null,
    publicAccess = false,
  } = opts;

  const ids = extractIdentityArgs(toolArgs);
  const sub = String(customerSubject || "").trim();
  const claimEmail = String(customerClaims?.email || "")
    .trim()
    .toLowerCase();
  const claimPhone = normalizePhone(customerClaims?.phone);

  // Foreign user id while signed in
  if (sub && ids.userId && ids.userId !== sub) {
    return {
      ok: false,
      code: "CROSS_USER_DENIED",
      message:
        "Tool arguments target a different user id than this conversation's signed-in subject.",
    };
  }

  // Guest/public path: refusing forged userId in args prevents elevation
  if (publicAccess && !sub && ids.userId) {
    return {
      ok: false,
      code: "CROSS_USER_DENIED",
      message:
        "Guest sessions cannot pass a userId in tool arguments. Sign in first.",
    };
  }

  if (claimEmail && ids.email && ids.email !== claimEmail) {
    return {
      ok: false,
      code: "CROSS_USER_DENIED",
      message: "Tool arguments use an email that does not match this visitor.",
    };
  }

  if (claimPhone && ids.phone && ids.phone !== claimPhone) {
    return {
      ok: false,
      code: "CROSS_USER_DENIED",
      message: "Tool arguments use a phone that does not match this visitor.",
    };
  }

  // Signed-in + email in args with no verified claim email — only allow if email
  // equals subject (some hosts use email-as-sub).
  if (sub && ids.email && !claimEmail) {
    const subLooksEmail = /\S+@\S+\.\S+/.test(sub);
    if (!subLooksEmail || ids.email !== sub.toLowerCase()) {
      return {
        ok: false,
        code: "CROSS_USER_DENIED",
        message:
          "Tool arguments include an email that is not bound to this visitor's verified claims.",
      };
    }
  }

  return { ok: true };
}

/**
 * Trusted context: conversation must belong to the agent being invoked.
 * @param {{ conversationAgentId?: string|null, invokeAgentId?: string|null, actionAgentId?: string|null }} opts
 */
export function assertConversationAgentBinding(opts = {}) {
  const conversationAgentId = opts.conversationAgentId
    ? String(opts.conversationAgentId)
    : null;
  const invokeAgentId = opts.invokeAgentId ? String(opts.invokeAgentId) : null;
  const actionAgentId = opts.actionAgentId ? String(opts.actionAgentId) : null;

  if (!invokeAgentId) {
    return {
      ok: false,
      code: "AUTHZ_CONTEXT_INVALID",
      message: "Missing agent context for this tool call.",
    };
  }

  if (actionAgentId && actionAgentId !== invokeAgentId) {
    return {
      ok: false,
      code: "AUTHZ_AGENT_MISMATCH",
      message: "Tool does not belong to this agent.",
    };
  }

  if (conversationAgentId && conversationAgentId !== invokeAgentId) {
    return {
      ok: false,
      code: "AUTHZ_CONVERSATION_MISMATCH",
      message: "Conversation does not belong to this agent.",
    };
  }

  return { ok: true };
}
