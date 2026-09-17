/**
 * Company-pack contract — CONTROL PLANE METADATA only.
 *
 * Decision (Task 10): do NOT wire procedure checkpoints into the chat
 * orchestrator. A pack describes business configuration for installers,
 * catalogs, and evaluation fixtures. It cannot grant identity, tenant,
 * confirmation, or capability authority.
 *
 * Single chat runtime story (unchanged):
 *   USER → AUTH → TRUSTED CONTEXT → ORCHESTRATOR → SOURCE ROUTER
 *   → POLICY PEP → TOOL GATEWAY → RESULT FENCE → ANSWER
 *
 * Identity, confirmation, and write gates stay in lib/actions/* and
 * confirmation.service — never in company-pack procedure steps.
 */

export const COMPANY_PACK_VERSION = 1;

/** Packs are install/catalog metadata — not a second runtime authority. */
export const COMPANY_PACK_RUNTIME_ROLE = "control_plane_metadata";

/**
 * Catalog procedure outline (documentation / future task adapters).
 * Not advanced by lib/orchestrator or chat.service today.
 */
export const PROCEDURE_STEPS = Object.freeze([
  "clarify",
  "collect_fields",
  "verify_identity",
  "read_authority",
  "apply_policy",
  "propose",
  "confirm",
  "execute",
  "verify",
  "explain_or_handoff",
]);

export const COMPANY_PACKS = Object.freeze({
  ECOMMERCE: Object.freeze({
    id: "ecommerce",
    vertical: "E-commerce",
    version: COMPANY_PACK_VERSION,
    locales: ["en"],
    currency: "USD",
    timezone: "UTC",
    knowledgePrecedence: ["RETURN_POLICY", "PRODUCT_CATALOG", "ORDER_API"],
    capabilitySlots: ["PUBLIC_READ", "GUEST_LOOKUP", "ACCOUNT_READ", "ACCOUNT_WRITE"],
    confirmation: { write: true, destructive: true },
    identity: { privateReads: true, writes: true },
    handoff: { enabled: true, queue: "support" },
    procedure: [...PROCEDURE_STEPS],
  }),
  SAAS: Object.freeze({
    id: "saas",
    vertical: "SaaS",
    version: COMPANY_PACK_VERSION,
    locales: ["en"],
    currency: "USD",
    timezone: "UTC",
    knowledgePrecedence: ["DOCUMENTATION", "PLANS", "ACCOUNT_API"],
    capabilitySlots: ["PUBLIC_READ", "GUEST_LOOKUP", "ACCOUNT_READ", "ACCOUNT_WRITE"],
    confirmation: { write: true, destructive: true },
    identity: { privateReads: true, writes: true },
    handoff: { enabled: true, queue: "support" },
    procedure: [...PROCEDURE_STEPS],
  }),
});

/** Always false — packs never authorize chat turns or tool calls. */
export function companyPackIsRuntimeAuthority() {
  return false;
}

/**
 * @param {object} business
 * @returns {object|null}
 */
export function companyPackForBusiness(business) {
  if (!business?.vertical) return null;
  if (business.vertical === "E-commerce") return clonePack(COMPANY_PACKS.ECOMMERCE);
  if (business.vertical === "SaaS") return clonePack(COMPANY_PACKS.SAAS);
  return null;
}

/**
 * Attach explicit non-runtime markers for pack-install API responses.
 * @param {object|null|undefined} pack
 */
export function serializeCompanyPackForInstall(pack) {
  if (!pack) return null;
  return {
    ...clonePack(pack),
    runtimeRole: COMPANY_PACK_RUNTIME_ROLE,
    runtimeAuthority: false,
  };
}

/**
 * Validate a pack before it is used by an installer or catalog.
 * Does not imply the pack is loaded into the chat orchestrator.
 * @param {object} pack
 */
export function validateCompanyPack(pack) {
  const required = ["id", "vertical", "version", "locales", "currency", "timezone", "procedure"];
  const missing = required.filter((key) => pack?.[key] == null);
  if (missing.length) return { ok: false, errorCode: "PACK_INVALID", missing };
  if (!Array.isArray(pack.locales) || !pack.locales.length) {
    return { ok: false, errorCode: "PACK_LOCALES_INVALID" };
  }
  if (!Array.isArray(pack.procedure) || !sameProcedure(pack.procedure)) {
    return { ok: false, errorCode: "PACK_PROCEDURE_INVALID" };
  }
  if (
    !Array.isArray(pack.capabilitySlots) ||
    !pack.capabilitySlots.includes("PUBLIC_READ")
  ) {
    return { ok: false, errorCode: "PACK_CAPABILITIES_INVALID" };
  }
  return { ok: true };
}

/**
 * Pure catalog helper: ordered procedure outline checks.
 * NOT imported by orchestrator/loop/chat.service. Confirmation and identity
 * for live tools remain in policy PEP + confirmation.service.
 */
export function canAdvanceProcedure(
  currentStep,
  nextStep,
  { identityVerified = false, confirmed = false } = {}
) {
  const currentIndex = PROCEDURE_STEPS.indexOf(currentStep);
  const nextIndex = PROCEDURE_STEPS.indexOf(nextStep);
  if (currentIndex < 0 || nextIndex !== currentIndex + 1) {
    return { ok: false, errorCode: "PROCEDURE_ORDER_INVALID" };
  }
  if (nextStep === "read_authority" && !identityVerified) {
    return { ok: false, errorCode: "IDENTITY_REQUIRED" };
  }
  if (nextStep === "execute" && !confirmed) {
    return { ok: false, errorCode: "CONFIRMATION_REQUIRED" };
  }
  return { ok: true };
}

function sameProcedure(procedure) {
  return (
    procedure.length === PROCEDURE_STEPS.length &&
    procedure.every((step, index) => step === PROCEDURE_STEPS[index])
  );
}

function clonePack(pack) {
  return JSON.parse(JSON.stringify(pack));
}
