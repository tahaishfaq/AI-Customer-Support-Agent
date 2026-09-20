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
    hint: "Tracking # or order id only — your API must redact PII. Do not return other customers' private fields. Prefer ACCOUNT_READ when the visitor is signed in.",
    identityMode: "OWNER_KEY",
    riskLevel: "READ",
    requiresConfirmation: true,
    requiresIdentity: false,
  },
  {
    id: "ACCOUNT_READ",
    label: "Signed-in users (read)",
    hint: "My order / my plan — requires Aide-signed identity JWT on embed (mint from your backend). Without HS256 proof this tool is denied.",
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

/** Tool names that must not run on embed as PUBLIC_READ + NONE (owner-key account scrape). */
export const ACCOUNT_RESOURCE_TOOL_NAME_RE =
  /^(shopify_get_order|get_order(_|$)|get_order_or_status|get_order_status|get_subscription|get_appointment|get_customer|get_payment|cancel_order|create_return)/i;

/**
 * True when urlTemplate is an Aide local demo fixture (/api/demo/…).
 * @param {string|null|undefined} urlTemplate
 */
export function isAideDemoActionUrl(urlTemplate) {
  return /\/api\/demo\//i.test(String(urlTemplate || ""));
}

/**
 * Fail closed before publish/enable when ACCOUNT_* identity fields are inconsistent.
 * @param {{ accessClass?: string, identityMode?: string, requiresIdentity?: boolean, name?: string, enabled?: boolean }} action
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export function assertAccountToolPublishSafe(action = {}) {
  const accessClass = String(action.accessClass || "").trim().toUpperCase();
  const identityMode = String(action.identityMode || "").trim().toUpperCase();
  const enabled = action.enabled !== false;

  if (!enabled) return { ok: true };

  if (accessClass === "ACCOUNT_READ" || accessClass === "ACCOUNT_WRITE" || accessClass === "DESTRUCTIVE") {
    if (identityMode !== "END_USER_TOKEN" || !action.requiresIdentity) {
      return {
        ok: false,
        code: "ACCOUNT_TOOL_IDENTITY_REQUIRED",
        message:
          "Account tools must use END_USER_TOKEN identity (Aide-signed JWT on embed) before publish.",
      };
    }
  }

  // Block publishing known account resource names as PUBLIC_READ + no identity.
  if (
    accessClass === "PUBLIC_READ" &&
    (identityMode === "NONE" || !identityMode) &&
    ACCOUNT_RESOURCE_TOOL_NAME_RE.test(String(action.name || "")) &&
    !isAideDemoActionUrl(action.urlTemplate)
  ) {
    return {
      ok: false,
      code: "ACCOUNT_TOOL_MISCONFIGURED",
      message:
        "This tool looks like customer account data. Set access class to ACCOUNT_READ (or GUEST_LOOKUP for redacted tracking-only), not PUBLIC_READ.",
    };
  }

  return { ok: true };
}
