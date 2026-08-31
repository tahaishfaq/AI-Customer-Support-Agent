/**
 * F11-U — accessClass mapping + resolve (DB column preferred, else infer).
 * Maps owner-friendly "who can use" → identityMode + riskLevel + confirm.
 */

export const ACTION_ACCESS_CLASSES = Object.freeze([
  "PUBLIC_READ",
  "GUEST_LOOKUP",
  "ACCOUNT_READ",
  "ACCOUNT_WRITE",
  "DESTRUCTIVE",
]);

export const ACCESS_CLASSES = Object.freeze([
  {
    id: "PUBLIC_READ",
    label: "Anyone (public info)",
    hint: "Catalog, hours, status pages — no personal data.",
    identityMode: "OWNER_KEY",
    riskLevel: "READ",
    requiresConfirmation: true,
    requiresIdentity: false,
  },
  {
    id: "GUEST_LOOKUP",
    label: "Guests with a lookup code",
    hint: "Tracking #, order+email — redacted status only.",
    identityMode: "OWNER_KEY",
    riskLevel: "READ",
    requiresConfirmation: true,
    requiresIdentity: false,
  },
  {
    id: "ACCOUNT_READ",
    label: "Signed-in users (read)",
    hint: "My order / my plan — needs setUser + owner ACL.",
    identityMode: "END_USER_TOKEN",
    riskLevel: "READ",
    requiresConfirmation: true,
    requiresIdentity: true,
  },
  {
    id: "ACCOUNT_WRITE",
    label: "Signed-in users (change)",
    hint: "Create ticket, update preference — confirm first.",
    identityMode: "END_USER_TOKEN",
    riskLevel: "WRITE",
    requiresConfirmation: true,
    requiresIdentity: true,
  },
  {
    id: "DESTRUCTIVE",
    label: "Signed-in users (cancel / delete)",
    hint: "Cancel, refund, freeze — strong confirm + ACL.",
    identityMode: "END_USER_TOKEN",
    riskLevel: "DESTRUCTIVE",
    requiresConfirmation: true,
    requiresIdentity: true,
  },
]);

export function applyAccessClass(accessClassId) {
  const row = ACCESS_CLASSES.find((c) => c.id === accessClassId);
  if (!row) return null;
  return {
    accessClass: row.id,
    identityMode: row.identityMode,
    riskLevel: row.riskLevel,
    requiresConfirmation: row.requiresConfirmation,
    requiresIdentity: row.requiresIdentity,
  };
}

/** Best-effort infer from existing action fields (for form hydrate / backfill). */
export function inferAccessClass(action = {}) {
  const stored = String(action.accessClass || "").trim().toUpperCase();
  if (ACTION_ACCESS_CLASSES.includes(stored)) return stored;

  const mode = String(action.identityMode || "").toUpperCase();
  const risk = String(action.riskLevel || "READ").toUpperCase();
  if (mode === "END_USER_TOKEN" || action.requiresIdentity) {
    if (risk === "DESTRUCTIVE") return "DESTRUCTIVE";
    if (risk === "WRITE") return "ACCOUNT_WRITE";
    return "ACCOUNT_READ";
  }
  const name = String(action.name || "").toLowerCase();
  const desc = String(action.description || "").toLowerCase();
  if (
    /track|lookup|guest|pnr|reservation.?lookup|order.?lookup/.test(
      `${name} ${desc}`
    )
  ) {
    return "GUEST_LOOKUP";
  }
  return "PUBLIC_READ";
}

/**
 * Normalize create/update: prefer explicit accessClass; sync identity/risk from it.
 * @param {{ accessClass?: string, identityMode?: string, riskLevel?: string, requiresIdentity?: boolean, requiresConfirmation?: boolean }} data
 */
export function syncAccessClassFields(data = {}) {
  let accessClass = String(data.accessClass || "").trim().toUpperCase();
  if (!ACTION_ACCESS_CLASSES.includes(accessClass)) {
    accessClass = inferAccessClass(data);
  }
  const mapped = applyAccessClass(accessClass) || applyAccessClass("PUBLIC_READ");
  return {
    ...mapped,
    // Allow caller to keep an explicit requiresConfirmation if already true
    requiresConfirmation:
      data.requiresConfirmation === true
        ? true
        : mapped.requiresConfirmation,
  };
}
