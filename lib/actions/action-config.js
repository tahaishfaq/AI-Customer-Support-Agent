/**
 * F11 Phase A — scope & identity contracts for agent HTTP actions.
 */

import { resolveIdentityMode } from "./identity-mode.js";
import { inferAccessClass } from "./access-class.js";

export const ACTION_HTTP_METHODS = Object.freeze(["GET", "POST"]);

export const TOOL_RUN_STATUS = Object.freeze({
  OK: "OK",
  ERROR: "ERROR",
  TIMEOUT: "TIMEOUT",
  SSRF_BLOCKED: "SSRF_BLOCKED",
  SCHEMA_INVALID: "SCHEMA_INVALID",
  DISABLED: "DISABLED",
  UNKNOWN_TOOL: "UNKNOWN_TOOL",
  MAX_STEPS: "MAX_STEPS",
});

/** Soft cap for LLM tool rounds per chat turn. */
export const MAX_TOOL_STEPS = 3;

/** Soft ceiling for the whole tool loop under a chat request (ms). */
export const TOOL_LOOP_DEADLINE_MS = 25_000;

/** Max parallel outbound HTTP action calls per agent (per instance). */
export const MAX_CONCURRENT_OUTBOUND = 2;

/** Placeholder shown in owner UI instead of secret / env values. */
export const SECRET_REDACT_PLACEHOLDER = "••••";

/** Default per-action HTTP timeout (ms). */
export const DEFAULT_ACTION_TIMEOUT_MS = 8000;

/** Soft ceiling for any single action timeout (ms). */
export const MAX_ACTION_TIMEOUT_MS = 15000;

/** Action names must be stable tool ids for the model. */
export const ACTION_NAME_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

/**
 * Owner (or same workspace actor) may edit/run actions for this agent.
 * Platform admin stays inspect-only — not an actor here.
 */
export function canManageAgentActions({ userId, agent }) {
  if (!userId || !agent?.userId) return false;
  return agent.userId === userId;
}

/**
 * Only enabled actions belonging to this agent may be invoked in chat.
 */
export function canInvokeAgentAction(action, agentId) {
  if (!action || !agentId) return false;
  if (action.agentId !== agentId) return false;
  return action.enabled === true;
}

export function isAllowedActionHttpMethod(method) {
  return ACTION_HTTP_METHODS.includes(String(method || "").toUpperCase());
}

export function normalizeActionName(value) {
  const name = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return name;
}

export function isValidActionName(value) {
  return ACTION_NAME_PATTERN.test(normalizeActionName(value));
}

export function clampActionTimeoutMs(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_ACTION_TIMEOUT_MS;
  return Math.min(Math.max(Math.floor(n), 1000), MAX_ACTION_TIMEOUT_MS);
}

/**
 * MVP secrets: only env refs like {{env:SHOP_API_KEY}} — never store raw keys in DB.
 * Phase later may add encrypted secrets; bcrypt hash is banned (not reversible).
 */
export function isEnvSecretRef(token) {
  return /^env:[A-Z][A-Z0-9_]{0,127}$/.test(String(token || "").trim());
}

/**
 * Redact header values for owner UI — env refs and opaque secrets become ••••.
 * Does not expand secrets; never returns live env values.
 */
export function redactHeadersJsonForUi(headersJson) {
  if (!headersJson || typeof headersJson !== "object" || Array.isArray(headersJson)) {
    return headersJson ?? null;
  }
  const out = {};
  for (const [key, raw] of Object.entries(headersJson)) {
    out[key] = redactHeaderValueForUi(String(raw ?? ""));
  }
  return out;
}

export function redactHeaderValueForUi(value) {
  const text = String(value ?? "");
  if (!text) return text;
  if (text.includes(SECRET_REDACT_PLACEHOLDER)) return text;
  // Keep structure of Bearer {{env:KEY}} → Bearer ••••
  if (/\{\{\s*env:[A-Z][A-Z0-9_]{0,127}\s*\}\}/.test(text)) {
    return text.replace(
      /\{\{\s*env:[A-Z][A-Z0-9_]{0,127}\s*\}\}/g,
      SECRET_REDACT_PLACEHOLDER
    );
  }
  if (/\{\{\s*credential:[a-z][a-z0-9_]{0,63}\s*\}\}/i.test(text)) {
    return text.replace(
      /\{\{\s*credential:[a-z][a-z0-9_]{0,63}\s*\}\}/gi,
      SECRET_REDACT_PLACEHOLDER
    );
  }
  if (/\{\{[^}]+\}\}/.test(text)) {
    // Non-secret arg templates stay visible
    return text;
  }
  // Bearer / Basic opaque credentials
  if (/^(Bearer|Basic)\s+\S+/i.test(text)) {
    const scheme = text.split(/\s+/)[0];
    return `${scheme} ${SECRET_REDACT_PLACEHOLDER}`;
  }
  // Common opaque API key shapes (not MIME types / short flags)
  if (/^(sk-|rk-|pk-|xox[baprs]-)/i.test(text)) {
    return SECRET_REDACT_PLACEHOLDER;
  }
  if (/^[A-Za-z0-9_\-./+=]{24,}$/.test(text) && !text.includes("/")) {
    return SECRET_REDACT_PLACEHOLDER;
  }
  return text;
}

/**
 * When the owner saves redacted headers, keep previous secret values for •••• keys.
 */
export function mergeHeadersPreservingSecrets(submitted, previous) {
  if (submitted === undefined) return undefined;
  if (submitted === null) return null;
  if (typeof submitted !== "object" || Array.isArray(submitted)) return submitted;

  const prev =
    previous && typeof previous === "object" && !Array.isArray(previous)
      ? previous
      : {};
  const out = {};
  for (const [key, raw] of Object.entries(submitted)) {
    const value = String(raw ?? "");
    if (
      value.includes(SECRET_REDACT_PLACEHOLDER) &&
      Object.prototype.hasOwnProperty.call(prev, key)
    ) {
      out[key] = prev[key];
    } else {
      out[key] = raw;
    }
  }
  return out;
}

export const ACTION_RISK_LEVELS = Object.freeze(["READ", "WRITE", "DESTRUCTIVE"]);

/**
 * Serialize an action for owner UI — never expand env secrets; redact header values.
 */
export function serializeActionForOwner(action) {
  if (!action) return null;
  return {
    id: action.id,
    agentId: action.agentId,
    name: action.name,
    description: action.description,
    method: action.method,
    urlTemplate: action.urlTemplate,
    frozenHost: action.frozenHost ?? null,
    headersJson: redactHeadersJsonForUi(action.headersJson),
    inputSchemaJson: action.inputSchemaJson ?? null,
    outputSchemaJson: action.outputSchemaJson ?? null,
    enabled: Boolean(action.enabled),
    timeoutMs: clampActionTimeoutMs(action.timeoutMs),
    credentialId: action.credentialId ?? null,
    riskLevel: action.riskLevel || "READ",
    requiresConfirmation: Boolean(action.requiresConfirmation),
    requiresIdentity: Boolean(action.requiresIdentity),
    identityMode: resolveIdentityMode(action),
    accessClass: inferAccessClass(action),
    idempotent: action.idempotent !== false,
    version: Number(action.version) || 1,
    createdAt: action.createdAt,
    updatedAt: action.updatedAt,
  };
}

/** Studio template library — multi-vertical starters (copies, not core types). */
export const ACTION_TEMPLATES = Object.freeze([
  {
    id: "get_json_by_id",
    label: "GET JSON by id",
    name: "get_json_by_id",
    description: "Fetch a JSON resource by id from an HTTPS API",
    method: "GET",
    urlTemplate: "https://api.example.com/items/{{id}}",
    headersJson: { Accept: "application/json" },
    inputSchemaJson: { id: "string" },
    riskLevel: "READ",
    requiresIdentity: false,
    identityMode: "NONE",
    requiresConfirmation: false,
    testArgs: { id: "123" },
  },
  {
    id: "demo_order_status",
    label: "Demo order status (e‑commerce)",
    name: "get_order_status",
    description: "Look up shipping status for an order id (local demo API)",
    method: "GET",
    urlTemplate: "http://localhost:3000/api/demo/orders/{{orderId}}",
    headersJson: { Accept: "application/json" },
    inputSchemaJson: { orderId: "string" },
    riskLevel: "READ",
    requiresIdentity: false,
    identityMode: "NONE",
    requiresConfirmation: false,
    testArgs: { orderId: "ORD-100" },
  },
  {
    id: "demo_campaign_status",
    label: "Demo campaign status (local fixture)",
    name: "get_campaign_status",
    description:
      "Look up Brandly-style campaign status by id (local demo — not e‑commerce orders)",
    method: "GET",
    urlTemplate: "http://localhost:3000/api/demo/campaigns/{{campaignId}}",
    headersJson: { Accept: "application/json" },
    inputSchemaJson: { campaignId: "string" },
    riskLevel: "READ",
    requiresIdentity: false,
    identityMode: "NONE",
    requiresConfirmation: false,
    testArgs: { campaignId: "CAMP-100" },
  },
  {
    id: "brandly_list_campaigns",
    label: "Brandly list campaigns (real API)",
    name: "list_brandly_campaigns",
    description:
      "Search Brandly campaigns by name/keyword. Use this FIRST when the user says a campaign name like Hel. Returns _id values to pass to get_brandly_campaign.",
    method: "GET",
    urlTemplate:
      "http://127.0.0.1:8000/api/v1/campaigns?search={{query}}&limit=5",
    headersJson: { Accept: "application/json" },
    inputSchemaJson: { query: "string" },
    riskLevel: "READ",
    requiresIdentity: false,
    identityMode: "NONE",
    requiresConfirmation: false,
    testArgs: { query: "Hel" },
  },
  {
    id: "brandly_campaign_status",
    label: "Brandly campaign by id (real API)",
    name: "get_brandly_campaign",
    description:
      "Fetch one Brandly campaign by MongoDB _id only (24-char hex). Do NOT pass a name like Hel — use list_brandly_campaigns first. When the user only asks for status, reply with status (and name) only — do not dump the full profile, image, budget, or platforms unless they ask for details.",
    method: "GET",
    urlTemplate: "http://127.0.0.1:8000/api/v1/campaigns/{{campaignId}}",
    headersJson: { Accept: "application/json" },
    inputSchemaJson: { campaignId: "string" },
    riskLevel: "READ",
    requiresIdentity: false,
    identityMode: "NONE",
    requiresConfirmation: false,
    testArgs: { campaignId: "6a7229b34a438ace7e21e325" },
  },
  {
    id: "get_appointment",
    label: "Get appointment (clinic)",
    name: "get_appointment",
    description: "Fetch appointment details by id — owner API must ACL by customer subject",
    method: "GET",
    urlTemplate: "https://api.example.com/appointments/{{appointmentId}}",
    headersJson: { Accept: "application/json" },
    inputSchemaJson: { appointmentId: "string" },
    riskLevel: "READ",
    requiresIdentity: true,
    identityMode: "END_USER_TOKEN",
    requiresConfirmation: false,
    testArgs: { appointmentId: "APT-100" },
  },
  {
    id: "create_support_ticket",
    label: "Create support ticket",
    name: "create_support_ticket",
    description: "Open a support ticket (WRITE — confirmation required)",
    method: "POST",
    urlTemplate: "https://api.example.com/tickets",
    headersJson: { "Content-Type": "application/json", Accept: "application/json" },
    inputSchemaJson: { subject: "string", body: "string" },
    riskLevel: "WRITE",
    requiresIdentity: true,
    identityMode: "END_USER_TOKEN",
    requiresConfirmation: true,
    idempotent: true,
    testArgs: { subject: "Billing question", body: "Need invoice copy" },
  },
  {
    id: "get_subscription",
    label: "Get subscription (SaaS)",
    name: "get_subscription",
    description: "Fetch plan/usage for the signed-in customer subject",
    method: "GET",
    urlTemplate: "https://api.example.com/subscriptions/me",
    headersJson: { Accept: "application/json" },
    inputSchemaJson: {},
    riskLevel: "READ",
    requiresIdentity: true,
    identityMode: "END_USER_TOKEN",
    requiresConfirmation: false,
    testArgs: {},
  },
  {
    id: "shopify_get_order",
    label: "Shopify get order (starter)",
    name: "shopify_get_order",
    description:
      "Look up a Shopify order by id — replace URL with your Admin/API or app proxy, then attach a credential",
    method: "GET",
    urlTemplate: "https://api.example.com/shopify/orders/{{orderId}}.json",
    headersJson: { Accept: "application/json" },
    inputSchemaJson: { orderId: "string" },
    riskLevel: "READ",
    requiresIdentity: false,
    identityMode: "NONE",
    requiresConfirmation: false,
    testArgs: { orderId: "1001" },
  },
  {
    id: "hubspot_create_ticket",
    label: "HubSpot create ticket (starter)",
    name: "hubspot_create_ticket",
    description:
      "Open a HubSpot ticket (WRITE — confirmation required). Point URL at your HubSpot CRM API after OAuth or private app token.",
    method: "POST",
    urlTemplate: "https://api.example.com/hubspot/tickets",
    headersJson: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    inputSchemaJson: { subject: "string", body: "string" },
    riskLevel: "WRITE",
    requiresIdentity: true,
    identityMode: "END_USER_TOKEN",
    requiresConfirmation: true,
    idempotent: true,
    testArgs: { subject: "Need help", body: "Order question" },
  },
  /* F13-T0 — site_demo_v1 (local Aide demo APIs; owner edits URL later) */
  {
    id: "site_list_items",
    label: "Site demo — list items",
    name: "list_items",
    description: "Browse catalog / campaigns for the embed site (demo fixture)",
    method: "GET",
    urlTemplate: "http://127.0.0.1:3000/api/demo/items",
    headersJson: { Accept: "application/json" },
    inputSchemaJson: {},
    riskLevel: "READ",
    requiresIdentity: false,
    identityMode: "NONE",
    requiresConfirmation: false,
    testArgs: {},
  },
  {
    id: "site_get_item",
    label: "Site demo — get item",
    name: "get_item_by_id",
    description: "Look up one catalog item by id (demo fixture)",
    method: "GET",
    urlTemplate: "http://127.0.0.1:3000/api/demo/items/{{itemId}}",
    headersJson: { Accept: "application/json" },
    inputSchemaJson: { itemId: "string" },
    riskLevel: "READ",
    requiresIdentity: false,
    identityMode: "NONE",
    requiresConfirmation: false,
    testArgs: { itemId: "ITEM-1" },
  },
  {
    id: "site_order_status",
    label: "Site demo — order / status",
    name: "get_order_or_status",
    description: "Order or status lookup for the visitor (demo order API)",
    method: "GET",
    urlTemplate: "http://127.0.0.1:3000/api/demo/orders/{{orderId}}",
    headersJson: { Accept: "application/json" },
    inputSchemaJson: { orderId: "string" },
    riskLevel: "READ",
    requiresIdentity: false,
    identityMode: "NONE",
    requiresConfirmation: false,
    testArgs: { orderId: "ORD-100" },
  },
  {
    id: "site_search_help",
    label: "Site demo — search help",
    name: "search_help",
    description: "Search help articles via API (demo help index)",
    method: "GET",
    urlTemplate: "http://127.0.0.1:3000/api/demo/help?q={{query}}",
    headersJson: { Accept: "application/json" },
    inputSchemaJson: { query: "string" },
    riskLevel: "READ",
    requiresIdentity: false,
    identityMode: "NONE",
    requiresConfirmation: false,
    testArgs: { query: "refund" },
  },
  {
    id: "site_create_ticket",
    label: "Site demo — create ticket",
    name: "create_lead_or_ticket",
    description: "Create a support ticket / lead (WRITE — confirmation required)",
    method: "POST",
    urlTemplate: "http://127.0.0.1:3000/api/demo/tickets",
    headersJson: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    inputSchemaJson: { subject: "string", body: "string" },
    riskLevel: "WRITE",
    requiresIdentity: false,
    identityMode: "NONE",
    requiresConfirmation: true,
    idempotent: true,
    testArgs: { subject: "Need help", body: "Demo ticket" },
  },
  {
    id: "site_update_preference",
    label: "Site demo — update preference",
    name: "update_preference",
    description:
      "Update a signed-in visitor preference (WRITE + login + confirmation)",
    method: "POST",
    urlTemplate: "http://127.0.0.1:3000/api/demo/preferences",
    headersJson: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    inputSchemaJson: { key: "string", value: "string" },
    riskLevel: "WRITE",
    requiresIdentity: true,
    identityMode: "END_USER_TOKEN",
    requiresConfirmation: true,
    idempotent: true,
    testArgs: { key: "newsletter", value: "weekly" },
  },
  {
    id: "post_webhook",
    label: "POST webhook",
    name: "post_webhook",
    description: "Notify an HTTPS webhook with a short message payload",
    method: "POST",
    urlTemplate: "https://hooks.example.com/incoming",
    headersJson: {
      "Content-Type": "application/json",
      Authorization: "Bearer {{env:WEBHOOK_TOKEN}}",
    },
    inputSchemaJson: { message: "string" },
    riskLevel: "WRITE",
    requiresIdentity: false,
    identityMode: "NONE",
    requiresConfirmation: true,
    idempotent: true,
    testArgs: { message: "hello" },
  },
]);
