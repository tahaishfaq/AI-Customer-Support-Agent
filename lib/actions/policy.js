/**
 * F11-R2 / F14-D / F11-U — deterministic action policy (identity + confirmation + cross-user).
 * LLM is never the PEP.
 */
import {
  resolveIdentityMode,
  requiresCustomerIdentity,
} from "./identity-mode.js";
import { detectCrossUserRequest } from "./response-sanitize.js";

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
}) {
  const identityMode = resolveIdentityMode(action);
  const needsIdentity = requiresCustomerIdentity(action);
  const risk = String(action?.riskLevel || "READ").toUpperCase();

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
