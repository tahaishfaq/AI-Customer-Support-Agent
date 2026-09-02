/**
 * F13-T0 — site demo pack helpers (client-safe).
 */

export const SITE_DEMO_PACK_ID = "site_demo_v1";

export const SITE_DEMO_ACTION_NAMES = Object.freeze([
  "list_items",
  "get_item_by_id",
  "get_order_or_status",
  "search_help",
  "create_lead_or_ticket",
  "update_preference",
]);

/** True when at least one site-demo action already exists on the agent. */
export function isSiteDemoInstalled(actions = []) {
  const names = new Set(
    (Array.isArray(actions) ? actions : []).map((a) => a?.name).filter(Boolean)
  );
  return SITE_DEMO_ACTION_NAMES.some((n) => names.has(n));
}

export function siteDemoInstallCopy(hostLabel) {
  const host = hostLabel || "your site";
  return `Install 6 starter tools for ${host}? Editable demo URLs — replace with your live API in HTTP.`;
}
