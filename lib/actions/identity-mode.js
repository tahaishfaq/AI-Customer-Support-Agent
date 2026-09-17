/**
 * F14-D — action identity / credential scope modes.
 * NONE | OWNER_KEY | END_USER_TOKEN
 *
 * When accessClass is set, it is authoritative for identity mode so a
 * mis-saved ACCOUNT_* tool cannot run without a verified end-user subject.
 */

import { applyAccessClass, ACTION_ACCESS_CLASSES } from "./access-class.js";

export const ACTION_IDENTITY_MODES = Object.freeze([
  "NONE",
  "OWNER_KEY",
  "END_USER_TOKEN",
]);

/**
 * Resolve effective mode (accessClass → identityMode → legacy requiresIdentity).
 * @param {{ accessClass?: string|null, identityMode?: string|null, requiresIdentity?: boolean }|null} action
 */
export function resolveIdentityMode(action) {
  const access = String(action?.accessClass || "").trim().toUpperCase();
  if (ACTION_ACCESS_CLASSES.includes(access)) {
    const mapped = applyAccessClass(access);
    if (mapped?.identityMode) return mapped.identityMode;
  }
  const raw = String(action?.identityMode || "").trim().toUpperCase();
  if (ACTION_IDENTITY_MODES.includes(raw)) return raw;
  return action?.requiresIdentity ? "END_USER_TOKEN" : "NONE";
}

/** Needs signed-in visitor subject (and usually an access token). */
export function requiresCustomerIdentity(action) {
  return resolveIdentityMode(action) === "END_USER_TOKEN";
}

/**
 * Normalize create/update payload: keep identityMode + requiresIdentity in sync.
 * @param {{ accessClass?: string, identityMode?: string, requiresIdentity?: boolean }} data
 */
export function syncIdentityFields(data = {}) {
  const access = String(data.accessClass || "").trim().toUpperCase();
  if (ACTION_ACCESS_CLASSES.includes(access)) {
    const mapped = applyAccessClass(access);
    return {
      identityMode: mapped.identityMode,
      requiresIdentity: mapped.requiresIdentity,
    };
  }
  let mode = data.identityMode;
  if (mode == null && data.requiresIdentity !== undefined) {
    mode = data.requiresIdentity ? "END_USER_TOKEN" : "NONE";
  }
  const identityMode = resolveIdentityMode({
    identityMode: mode,
    requiresIdentity: data.requiresIdentity,
  });
  return {
    identityMode,
    requiresIdentity: identityMode === "END_USER_TOKEN",
  };
}
