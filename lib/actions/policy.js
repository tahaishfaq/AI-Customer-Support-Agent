/**
 * F11-R2 / F14-D / F11-U / Stage 5.3 — deterministic action policy.
 * LLM is never the PEP.
 *
 * Embed ACCOUNT_* / END_USER_TOKEN tools require cryptographic identity proof
 * (hs256_jwt). Origin-trusted host_session alone is not enough on publicAccess.
 */
import {
  resolveIdentityMode,
  requiresCustomerIdentity,
} from "./identity-mode.js";
import { detectCrossUserRequest } from "./response-sanitize.js";
import { assertResourceSubjectBinding } from "./authz-binding.js";

export const IDENTITY_PROOF_REQUIRED = "IDENTITY_PROOF_REQUIRED";

/**
 * @param {{
 *   action: {
 *     requiresIdentity?: boolean,
 *     identityMode?: string,
 *     requiresConfirmation?: boolean,
 *     riskLevel?: string,
 *   },
 *   customerSubject?: string|null,
 *   endUserAccessToken?: string|null,
 *   confirmationStatus?: string|null,
 *   publicAccess?: boolean,
 *   lastUserMessage?: string|null,
 *   toolArgs?: object|null,
 *   customerClaims?: { email?: string|null, phone?: string|null }|null,
 *   identityStrategy?: "hs256_jwt"|"host_session"|null,
 * }} opts
 */
export function evaluateActionPolicy({
  action,
  customerSubject = null,
  endUserAccessToken = null,
  confirmationStatus = null,
  publicAccess = false,
  lastUserMessage = null,
  toolArgs = null,
  customerClaims = null,
  identityStrategy = null,
}) {
  const identityMode = resolveIdentityMode(action);
  const needsIdentity = requiresCustomerIdentity(action);
  const risk = String(action?.riskLevel || "READ").toUpperCase();
  const strategy = String(identityStrategy || "").trim().toLowerCase() || null;

  // F11-U: refuse cross-user / elevation asks before any HTTP.
  if (
    detectCrossUserRequest(
      lastUserMessage,
      toolArgs,
      customerSubject,
      customerClaims
    )
  ) {
    return {
      allow: false,
      code: "CROSS_USER_DENIED",
      message:
        "This request looks like it asks for someone else's account data. Refuse politely; only help with this visitor's own account.",
      needsConfirmation: false,
      needsIdentity: false,
      identityMode,
    };
  }

  // Stage 5.3 — hard resource binding (args vs trusted subject/claims).
  const resourceBind = assertResourceSubjectBinding({
    toolArgs,
    customerSubject,
    customerClaims,
    publicAccess,
  });
  if (!resourceBind.ok) {
    return {
      allow: false,
      code: resourceBind.code,
      message: resourceBind.message,
      needsConfirmation: false,
      needsIdentity: false,
      identityMode,
    };
  }

  // F11-U: every live tool on the public embed requires Confirm (studio can auto-run).
  const needsWriteConfirm =
    Boolean(action?.requiresConfirmation) ||
    risk === "WRITE" ||
    risk === "DESTRUCTIVE" ||
    Boolean(publicAccess);

  if (needsIdentity && !customerSubject) {
    return {
      allow: false,
      code: "IDENTITY_REQUIRED",
      message:
        "This action requires a signed-in customer identity. Ask the user to sign in.",
      needsConfirmation: needsWriteConfirm,
      needsIdentity: true,
      identityMode,
    };
  }

  // Embed: ACCOUNT / END_USER_TOKEN need Aide-verified HS256 — not browser setUser subject alone.
  if (needsIdentity && publicAccess && strategy !== "hs256_jwt") {
    return {
      allow: false,
      code: IDENTITY_PROOF_REQUIRED,
      message:
        "This account action needs an Aide-signed identity JWT from your backend (not browser setUser subject alone). Mint with ACTIONS_IDENTITY_SECRET or POST /api/agents/:id/identity/mint.",
      needsConfirmation: needsWriteConfirm,
      needsIdentity: true,
      identityMode,
    };
  }

  // F14-D: END_USER_TOKEN must not fall back to owner API keys.
  if (identityMode === "END_USER_TOKEN" && !endUserAccessToken) {
    return {
      allow: false,
      code: "END_USER_TOKEN_REQUIRED",
      message:
        "This action needs the visitor access token (aideChat.setUser). Owner API keys cannot be used for this call.",
      needsConfirmation: needsWriteConfirm,
      needsIdentity: true,
      identityMode,
    };
  }

  if (needsWriteConfirm) {
    const approved =
      String(confirmationStatus || "").toUpperCase() === "APPROVED";
    if (!approved) {
      return {
        allow: false,
        code: "CONFIRMATION_REQUIRED",
        message:
          "This action needs explicit user confirmation before it can run. Ask the user to confirm.",
        needsConfirmation: true,
        needsIdentity,
        identityMode,
      };
    }
  }

  return {
    allow: true,
    code: null,
    message: null,
    needsConfirmation: false,
    needsIdentity: false,
    identityMode,
  };
}
