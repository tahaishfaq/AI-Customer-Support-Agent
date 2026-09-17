/**
 * F11 UX-4 / F13 — Vertical integration packs (owner-facing registry).
 * Client-safe metadata only. Install uses action-packs API + ACTION_PACKS.
 * OAuth client-credentials helper: lib/integrations/oauth-client-credentials.js
 *
 * Use relative imports so Node smoke scripts (test:f13*) can load this file.
 */

import { SITE_DEMO_ACTION_NAMES } from "./site-demo-pack.js";
import {
  PACK_CONNECTION_STATUS,
  connectionStatusLabel,
} from "./pack-status.js";

/**
 * @typedef {"api_key" | "none" | "oauth_soon"} VerticalAuthMode
 */

/**
 * @typedef {object} VerticalPack
 * @property {string} id
 * @property {string} title
 * @property {string} blurb
 * @property {string} category
 * @property {VerticalAuthMode} auth
 * @property {string[]} packIds — ACTION_PACKS keys to install
 * @property {string[]} actionNames — AgentAction.name values for Enabled detection
 * @property {boolean} requiresCredential
 * @property {"template"} connectionStatus — catalog installers are templates, not live connectors
 * @property {boolean} [featured]
 * @property {string} [oauthNote]
 */

/** @type {VerticalPack[]} — Site demo + Brandly first */
export const VERTICAL_PACKS = Object.freeze([
  {
    id: "site_demo",
    title: "Site demo (6 tools)",
    blurb:
      "Template tools — list · get · order · help · ticket · preference on local demo APIs. Not a live site connector.",
    category: "Demo",
    auth: "none",
    packIds: ["site_demo_v1"],
    actionNames: [...SITE_DEMO_ACTION_NAMES],
    requiresCredential: false,
    connectionStatus: PACK_CONNECTION_STATUS.TEMPLATE,
    featured: true,
  },
  {
    id: "brandly",
    title: "Brandly",
    blurb:
      "Template campaign tools. Paste X-API-KEY on Connection, point at your Brandly host, then probe — install alone is not connected.",
    category: "Marketplace",
    auth: "api_key",
    packIds: ["brandly"],
    actionNames: ["list_brandly_campaigns", "get_brandly_campaign"],
    requiresCredential: true,
    connectionStatus: PACK_CONNECTION_STATUS.TEMPLATE,
    featured: true,
  },
  {
    id: "demo",
    title: "AIDE Demo",
    blurb: "Template fixtures for order + campaign — local demo URLs, no merchant connection.",
    category: "Demo",
    auth: "none",
    packIds: ["demo_order", "brandly_demo"],
    actionNames: ["get_order_status", "get_campaign_status"],
    requiresCredential: false,
    connectionStatus: PACK_CONNECTION_STATUS.TEMPLATE,
    featured: true,
  },
  {
    id: "shopify",
    title: "Shopify",
    blurb:
      "Template order lookup (example.com). Not a connected Shopify store — edit URL, attach credential, then probe.",
    category: "Commerce",
    auth: "oauth_soon",
    packIds: ["shopify_lite"],
    actionNames: ["shopify_get_order"],
    requiresCredential: false,
    connectionStatus: PACK_CONNECTION_STATUS.TEMPLATE,
    featured: true,
    oauthNote:
      "Shopify prefers OAuth apps. Pack install is a template. Attach a *.myshopify.com IntegrationConnection + Admin API access-token credential (X-Shopify-Access-Token) so the Shopify Admin connector can fetch orders — install alone does not connect a store.",
  },
  {
    id: "hubspot",
    title: "HubSpot",
    blurb:
      "Template create-ticket (example.com, needs confirm). Not a connected HubSpot portal until URL + credential + probe.",
    category: "CRM",
    auth: "oauth_soon",
    packIds: ["hubspot_lite"],
    actionNames: ["hubspot_create_ticket"],
    requiresCredential: false,
    connectionStatus: PACK_CONNECTION_STATUS.TEMPLATE,
    featured: true,
    oauthNote:
      "Full HubSpot OAuth install is not wired yet. Pack install is a template only — use a private app token as Bearer after editing the URL, or wait for OAuth credential type.",
  },
  {
    id: "booking",
    title: "Appointments",
    blurb: "Template get-by-id starter (example.com). Not connected until you point it at your booking API.",
    category: "Services",
    auth: "api_key",
    packIds: ["booking"],
    actionNames: ["get_appointment"],
    requiresCredential: false,
    connectionStatus: PACK_CONNECTION_STATUS.TEMPLATE,
  },
  {
    id: "ticket",
    title: "Support tickets",
    blurb: "Template create-ticket starter — confirmation + login. Replace example.com before going live.",
    category: "Support",
    auth: "api_key",
    packIds: ["ticket"],
    actionNames: ["create_support_ticket"],
    requiresCredential: false,
    connectionStatus: PACK_CONNECTION_STATUS.TEMPLATE,
  },
  {
    id: "subscription",
    title: "Subscriptions",
    blurb: "Template SaaS plan/usage starter for signed-in visitors — not a live billing connector.",
    category: "SaaS",
    auth: "api_key",
    packIds: ["subscription"],
    actionNames: ["get_subscription"],
    requiresCredential: false,
    connectionStatus: PACK_CONNECTION_STATUS.TEMPLATE,
  },
]);

export function authBadgeLabel(auth) {
  if (auth === "oauth_soon") return "OAuth soon";
  if (auth === "api_key") return "API key";
  if (auth === "none") return "No key";
  return auth;
}

/** Owner-facing connection badge — never "Connected" for catalog packs. */
export function verticalConnectionBadgeLabel(pack) {
  return connectionStatusLabel(
    pack?.connectionStatus || PACK_CONNECTION_STATUS.TEMPLATE
  );
}

export function listFeaturedVerticalPacks() {
  return VERTICAL_PACKS.filter((p) => p.featured);
}

export function getVerticalPack(id) {
  return VERTICAL_PACKS.find((p) => p.id === id) || null;
}

/** True when at least one pack action name exists on the agent. */
export function isVerticalInstalled(vertical, actions = []) {
  const expected = vertical?.actionNames || [];
  if (!expected.length) return false;
  const names = new Set(
    (Array.isArray(actions) ? actions : []).map((a) => a?.name).filter(Boolean)
  );
  return expected.some((n) => names.has(n));
}

export function filterVerticalPacks(packs, query) {
  const list = Array.isArray(packs) ? packs : [];
  const q = String(query || "")
    .trim()
    .toLowerCase();
  if (!q) return list;
  return list.filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.blurb.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
  );
}

/** Split into Enabled / Available (order preserved). */
export function partitionVerticalPacks(packs, actions) {
  const enabled = [];
  const available = [];
  for (const p of packs || []) {
    if (isVerticalInstalled(p, actions)) enabled.push(p);
    else available.push(p);
  }
  return { enabled, available };
}

/** Owner-facing category order for Integrations hub. */
export const VERTICAL_CATEGORY_ORDER = Object.freeze([
  "Demo",
  "Marketplace",
  "Commerce",
  "CRM",
  "Services",
  "Support",
  "SaaS",
]);

/**
 * Group packs by category for Integrations UI.
 * @returns {{ category: string, packs: VerticalPack[] }[]}
 */
export function groupVerticalPacksByCategory(packs) {
  const buckets = new Map();
  for (const p of packs || []) {
    const cat = p.category || "Other";
    if (!buckets.has(cat)) buckets.set(cat, []);
    buckets.get(cat).push(p);
  }
  const ordered = [];
  for (const cat of VERTICAL_CATEGORY_ORDER) {
    if (buckets.has(cat) && buckets.get(cat).length) {
      ordered.push({ category: cat, packs: buckets.get(cat) });
      buckets.delete(cat);
    }
  }
  for (const [category, list] of buckets) {
    if (list.length) ordered.push({ category, packs: list });
  }
  return ordered;
}
