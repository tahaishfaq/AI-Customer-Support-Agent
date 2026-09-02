/**
 * F11 UX-2 — Human capability catalog (cards → ACTION_TEMPLATES / packs).
 * Soft UI copy only; runtime still uses AgentAction + executor policy.
 * Keep this file client-safe (no Prisma).
 */
import { ACTION_TEMPLATES } from "./action-config.js";

/** Known pack ids (mirror lib/integrations/action-pack.js — do not import that module here). */
const KNOWN_PACK_IDS = new Set([
  "demo_order",
  "brandly",
  "brandly_demo",
  "booking",
  "ticket",
  "subscription",
  "shopify_lite",
  "hubspot_lite",
  "site_demo_v1",
]);

/**
 * @typedef {object} CapabilityCard
 * @property {string} id
 * @property {string} title
 * @property {string} benefit
 * @property {string} example
 * @property {string} templateId
 * @property {boolean} [sampleReady] — demo/live sample args known to work in Test
 */

/**
 * @typedef {object} CapabilityGroup
 * @property {string} id
 * @property {string} title
 * @property {string} blurb
 * @property {string} [category] — Integrations category (Demo, Marketplace, …)
 * @property {string | null} packId
 * @property {string[]} [packIds]
 * @property {boolean} [requiresCredential]
 * @property {CapabilityCard[]} cards
 */

/** @type {CapabilityGroup[]} */
export const CAPABILITY_GROUPS = Object.freeze([
  {
    id: "brandly",
    title: "Brandly",
    blurb: "Live campaigns — connect your Brandly API key first.",
    category: "Marketplace",
    packId: "brandly",
    requiresCredential: true,
    cards: [
      {
        id: "brandly_list",
        title: "List campaigns",
        benefit: "Find campaigns by name when visitors ask about status.",
        example: "Show campaigns named Hel",
        templateId: "brandly_list_campaigns",
        sampleReady: true,
      },
      {
        id: "brandly_get",
        title: "Get campaign",
        benefit: "Look up one campaign by id after listing.",
        example: "What’s the status of this campaign?",
        templateId: "brandly_campaign_status",
        sampleReady: true,
      },
    ],
  },
  {
    id: "demo",
    title: "Demo (local)",
    blurb: "Practice with Aide fixtures — no external API key required.",
    category: "Demo",
    packId: null,
    packIds: ["demo_order", "brandly_demo"],
    requiresCredential: false,
    cards: [
      {
        id: "demo_order",
        title: "Order status",
        benefit: "Look up shipping status for a demo order id.",
        example: "Where is order ORD-100?",
        templateId: "demo_order_status",
        sampleReady: true,
      },
      {
        id: "demo_campaign",
        title: "Campaign status",
        benefit: "Brandly-style fixture without a live key.",
        example: "Status for CAMP-100?",
        templateId: "demo_campaign_status",
        sampleReady: true,
      },
    ],
  },
  {
    id: "booking",
    title: "Appointments",
    blurb: "Clinic / booking starter — point the URL at your API in HTTP.",
    category: "Services",
    packId: "booking",
    requiresCredential: false,
    cards: [
      {
        id: "get_appointment",
        title: "Get appointment",
        benefit: "Fetch appointment details for a signed-in visitor.",
        example: "What’s my appointment APT-100?",
        templateId: "get_appointment",
        sampleReady: false,
      },
    ],
  },
  {
    id: "ticket",
    title: "Support tickets",
    blurb: "Create tickets — confirmation required before write.",
    category: "Support",
    packId: "ticket",
    requiresCredential: false,
    cards: [
      {
        id: "create_support_ticket",
        title: "Create ticket",
        benefit: "Open a support ticket when the visitor asks for help.",
        example: "Create a ticket about billing",
        templateId: "create_support_ticket",
        sampleReady: false,
      },
    ],
  },
  {
    id: "subscription",
    title: "Subscriptions",
    blurb: "SaaS plan / usage — visitor must be logged in.",
    category: "SaaS",
    packId: "subscription",
    requiresCredential: false,
    cards: [
      {
        id: "get_subscription",
        title: "Get subscription",
        benefit: "Answer plan and usage questions for the signed-in customer.",
        example: "What plan am I on?",
        templateId: "get_subscription",
        sampleReady: false,
      },
    ],
  },
]);

export function listCapabilityCards() {
  return CAPABILITY_GROUPS.flatMap((g) =>
    g.cards.map((card) => ({
      ...card,
      groupId: g.id,
      packId: g.packId,
      requiresCredential: Boolean(g.requiresCredential),
      actionName: templateName(card.templateId),
    }))
  );
}

export function getTemplateForCapability(templateId) {
  return ACTION_TEMPLATES.find((t) => t.id === templateId) || null;
}

function templateName(templateId) {
  return getTemplateForCapability(templateId)?.name || templateId;
}

/**
 * Plain-language badges for owners (UX-2).
 * @returns {string[]}
 */
export function badgesForCapability(card, template) {
  const t = template || getTemplateForCapability(card.templateId);
  const badges = [];
  if (!t) {
    badges.push("Read");
    return badges;
  }
  if (t.riskLevel === "WRITE") {
    badges.push("Write");
  } else {
    badges.push("Read");
  }
  if (t.requiresConfirmation) badges.push("Needs confirm");
  if (t.requiresIdentity) badges.push("Needs login");
  if (card.sampleReady === false) badges.push("Edit URL");
  else if (String(t.urlTemplate || "").includes("/api/demo/")) {
    badges.push("Demo");
  } else if (
    String(t.urlTemplate || "").includes("127.0.0.1") ||
    String(t.urlTemplate || "").includes("brandly")
  ) {
    badges.push("Live");
  }
  return badges;
}

export function packIdsForGroup(group) {
  if (Array.isArray(group.packIds) && group.packIds.length) {
    return group.packIds.filter((id) => KNOWN_PACK_IDS.has(id));
  }
  if (group.packId && KNOWN_PACK_IDS.has(group.packId)) return [group.packId];
  return [];
}

export function sampleArgsForCapability(card) {
  const t = getTemplateForCapability(card.templateId);
  return t?.testArgs && typeof t.testArgs === "object" ? { ...t.testArgs } : {};
}
