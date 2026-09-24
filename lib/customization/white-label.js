/**
 * White-label (paid plans): company logo, uploaded launcher image, custom footer, AIDE branding off.
 * Pure helpers — the server decides access (entitlements) and strips before the widget renders.
 */
import { DEFAULT_CUSTOMIZATION, mergeCustomization } from "@/lib/customization/defaults";

export const WHITE_LABEL_PLAN_TYPES = new Set(["POPULAR", "TEAMS", "CUSTOM"]);

const DEFAULT_FOOTER = DEFAULT_CUSTOMIZATION.identity.footer;

/**
 * White-label fields a patch sets to a non-default value that differs from what is stored.
 * Unchanged values pass, so a full-draft save from the studio never trips on legacy settings.
 */
export function whiteLabelFieldsInPatch(patch, stored = null) {
  const current = mergeCustomization(stored);
  const fields = [];
  const identity = patch?.identity || {};
  const deploy = patch?.deploy || {};
  const branding = patch?.branding || {};
  const changed = (value, before) => value !== undefined && value !== before;
  if (identity.logoUrl && changed(identity.logoUrl, current.identity.logoUrl)) fields.push("identity.logoUrl");
  if (changed(identity.footer, current.identity.footer) && identity.footer !== DEFAULT_FOOTER) fields.push("identity.footer");
  if (deploy.buttonImageUrl && changed(deploy.buttonImageUrl, current.deploy.buttonImageUrl)) fields.push("deploy.buttonImageUrl");
  if (branding.hideAideBranding === true && changed(branding.hideAideBranding, current.branding.hideAideBranding)) fields.push("branding.hideAideBranding");
  return fields;
}

/** Customization as a non-white-label plan renders it: AIDE footer, default launcher, no logo. */
export function stripWhiteLabel(stored) {
  const merged = mergeCustomization(stored);
  return {
    ...merged,
    identity: { ...merged.identity, logoUrl: null, footer: DEFAULT_FOOTER },
    deploy: { ...merged.deploy, buttonImageUrl: null, useBotAvatar: true },
    branding: { ...merged.branding, hideAideBranding: false },
  };
}

export function isWhiteLabelPlan({ role = "USER", unlocked = false, planType = null } = {}) {
  if (role === "ADMIN") return true;
  return Boolean(unlocked && WHITE_LABEL_PLAN_TYPES.has(planType));
}
