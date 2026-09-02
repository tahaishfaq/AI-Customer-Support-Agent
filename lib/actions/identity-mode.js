/**
 * F14-D — action identity / credential scope modes.
 * NONE | OWNER_KEY | END_USER_TOKEN
 */

export const ACTION_IDENTITY_MODES = Object.freeze([
  "NONE",
  "OWNER_KEY",
  "END_USER_TOKEN",
]);

/**
 * Resolve effective mode (legacy requiresIdentity → END_USER_TOKEN).
 * @param {{ identityMode?: string|null, requiresIdentity?: boolean }|null} action
 */
export function resolveIdentityMode(action) {
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
 * @param {{ identityMode?: string, requiresIdentity?: boolean }} data
 */
export function syncIdentityFields(data = {}) {
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
