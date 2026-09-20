/**
 * Shopify Admin API connector — order GET via http-executor.
 * Auth uses X-Shopify-Access-Token from ActionCredential (never model-visible).
 */

import { extractFrozenHost } from "../../actions/frozen-host.js";
import { isDemoIntegrationUrl } from "../../embed/readiness.js";
import { scrubSecretsFromResult } from "./types.js";

export const SHOPIFY_ADMIN_API_VERSION = "2024-10";
export const SHOPIFY_ACCESS_TOKEN_HEADER = "X-Shopify-Access-Token";

/**
 * @param {string} hostname
 */
export function isShopifyAdminHostname(hostname) {
  const host = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(host);
}

/**
 * Normalize shop input to https://{shop}.myshopify.com origin.
 * @param {string} raw
 * @returns {string} origin
 */
export function normalizeShopifyShopOrigin(raw) {
  const text = String(raw || "").trim();
  if (!text) {
    const err = new Error("Shopify shop origin is required");
    err.status = 400;
    err.code = "CONNECTOR_CONFIG_INVALID";
    throw err;
  }

  let hostname = text;
  try {
    if (/^https?:\/\//i.test(text)) {
      hostname = new URL(text).hostname;
    } else if (text.includes("/")) {
      hostname = new URL(`https://${text}`).hostname;
    } else if (!text.includes(".")) {
      hostname = `${text}.myshopify.com`;
    }
  } catch {
    const err = new Error("Invalid Shopify shop origin");
    err.status = 400;
    err.code = "CONNECTOR_CONFIG_INVALID";
    throw err;
  }

  hostname = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
  if (!isShopifyAdminHostname(hostname)) {
    const err = new Error(
      "Shopify Admin connector requires a *.myshopify.com shop host"
    );
    err.status = 400;
    err.code = "CONNECTOR_CONFIG_INVALID";
    throw err;
  }

  return `https://${hostname}`;
}

/**
 * Resolve shop origin from connection revision or action URL (never from LLM prose).
 * @param {{
 *   connection?: { revision?: { baseOrigin?: string }|null }|null,
 *   action?: { urlTemplate?: string, frozenHost?: string }|null,
 * }} opts
 * @returns {string|null}
 */
export function resolveShopifyShopOriginFromContext({
  connection = null,
  action = null,
} = {}) {
  const fromConnection = connection?.revision?.baseOrigin;
  if (fromConnection && !isDemoIntegrationUrl(fromConnection)) {
    try {
      return normalizeShopifyShopOrigin(fromConnection);
    } catch {
      /* fall through */
    }
  }

  const host =
    action?.frozenHost ||
    extractFrozenHost(action?.urlTemplate || "") ||
    null;
  if (host && isShopifyAdminHostname(host)) {
    return normalizeShopifyShopOrigin(host);
  }

  const url = String(action?.urlTemplate || "");
  if (url && !isDemoIntegrationUrl(url)) {
    try {
      const parsed = new URL(url.replace(/\{\{[^}]+\}\}/g, "x"));
      if (isShopifyAdminHostname(parsed.hostname)) {
        return normalizeShopifyShopOrigin(parsed.hostname);
      }
    } catch {
      /* ignore */
    }
  }

  return null;
}

/**
 * Build a trusted Admin API GET for one order.
 * orderId is the only model-supplied value (path segment).
 * @param {{
 *   shopOrigin: string,
 *   orderId: string,
 *   apiVersion?: string,
 * }} opts
 */
export function buildShopifyGetOrderRequest({
  shopOrigin,
  orderId,
  apiVersion = SHOPIFY_ADMIN_API_VERSION,
}) {
  const origin = normalizeShopifyShopOrigin(shopOrigin);
  const id = String(orderId || "").trim();
  if (!/^\d{1,20}$/.test(id)) {
    const err = new Error("orderId must be a numeric Shopify order id");
    err.status = 400;
    err.code = "SCHEMA_INVALID";
    throw err;
  }
  const version = String(apiVersion || SHOPIFY_ADMIN_API_VERSION).trim();
  if (!/^\d{4}-\d{2}$/.test(version)) {
    const err = new Error("Invalid Shopify API version");
    err.status = 400;
    err.code = "CONNECTOR_CONFIG_INVALID";
    throw err;
  }

  const hostname = new URL(origin).hostname;
  return {
    method: "GET",
    urlTemplate: `${origin}/admin/api/${version}/orders/{{orderId}}.json`,
    headersJson: {
      Accept: "application/json",
      // Token is applied by http-executor via credential — never put plaintext here.
    },
    args: { orderId: id },
    frozenHost: hostname,
    riskLevel: "READ",
    idempotent: true,
  };
}

/**
 * Project Admin order JSON to a small model-safe fact set.
 * @param {string} bodyText
 */
export function projectShopifyOrderForModel(bodyText) {
  let parsed;
  try {
    parsed = JSON.parse(String(bodyText || ""));
  } catch {
    return bodyText;
  }
  const order = parsed?.order || parsed;
  if (!order || typeof order !== "object") return bodyText;

  const lines = Array.isArray(order.line_items) ? order.line_items : [];
  const slim = {
    id: order.id ?? null,
    name: order.name ?? null,
    financial_status: order.financial_status ?? null,
    fulfillment_status: order.fulfillment_status ?? null,
    total_price: order.total_price ?? null,
    currency: order.currency ?? null,
    created_at: order.created_at ?? null,
    line_items: lines.slice(0, 20).map((item) => ({
      title: item?.title ?? null,
      quantity: item?.quantity ?? null,
      sku: item?.sku ?? null,
    })),
  };
  return JSON.stringify({ order: slim });
}

/**
 * Enforce that a Shopify order belongs to the verified visitor (email / customer id).
 * @param {string} bodyText raw Admin API body
 * @param {{
 *   customerSubject?: string|null,
 *   customerClaims?: { email?: string|null, phone?: string|null }|null,
 * }} identity
 * @returns {{ ok: true, bodyText: string } | { ok: false, code: string, message: string }}
 */
export function assertShopifyOrderBelongsToCustomer(bodyText, identity = {}) {
  const subject = String(identity.customerSubject || "").trim();
  const claimEmail = String(identity.customerClaims?.email || "")
    .trim()
    .toLowerCase();
  if (!subject && !claimEmail) {
    return {
      ok: false,
      code: "ORDER_OWNERSHIP_UNPROVEN",
      message: "Verified customer identity is required to view this order.",
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(String(bodyText || ""));
  } catch {
    return {
      ok: false,
      code: "ORDER_OWNERSHIP_UNPROVEN",
      message: "Could not verify order ownership.",
    };
  }
  const order = parsed?.order || parsed;
  if (!order || typeof order !== "object") {
    return {
      ok: false,
      code: "ORDER_OWNERSHIP_UNPROVEN",
      message: "Could not verify order ownership.",
    };
  }

  const orderEmail = String(
    order.email || order.contact_email || order.customer?.email || ""
  )
    .trim()
    .toLowerCase();
  const customerId = String(order.customer?.id ?? order.user_id ?? "").trim();

  if (claimEmail && orderEmail && claimEmail === orderEmail) {
    return { ok: true, bodyText };
  }
  if (subject && customerId && subject === customerId) {
    return { ok: true, bodyText };
  }
  // Allow subject that looks like email matching order email
  if (subject.includes("@") && orderEmail && subject.toLowerCase() === orderEmail) {
    return { ok: true, bodyText };
  }

  return {
    ok: false,
    code: "ORDER_OWNERSHIP_DENIED",
    message: "This order does not belong to the signed-in customer.",
  };
}

/**
 * Execute Shopify Admin get-order through the shared HTTP executor.
 * @param {{
 *   orderId: string,
 *   shopOrigin: string,
 *   credential: { plaintext?: string, type?: string, headerName?: string|null }|null,
 *   executeHttpAction: Function,
 *   timeoutMs?: number,
 *   allowLocalDemo?: boolean,
 *   guestResponseCap?: boolean,
 *   signal?: AbortSignal,
 *   onDispatch?: Function,
 *   apiVersion?: string,
 * }} opts
 */
export async function executeShopifyGetOrder(opts) {
  const {
    orderId,
    shopOrigin,
    credential,
    executeHttpAction,
    timeoutMs = 8000,
    guestResponseCap = false,
    signal = null,
    onDispatch = null,
    apiVersion = SHOPIFY_ADMIN_API_VERSION,
    customerSubject = null,
    customerClaims = null,
  } = opts;

  if (!credential?.plaintext) {
    return {
      ok: false,
      status: "ERROR",
      httpStatus: null,
      durationMs: 0,
      errorCode: "CREDENTIAL_MISSING",
      bodyText: "Shopify access token credential is required",
      truncated: false,
      retried: false,
    };
  }

  let request;
  try {
    request = buildShopifyGetOrderRequest({
      shopOrigin,
      orderId,
      apiVersion,
    });
  } catch (err) {
    return {
      ok: false,
      status: err?.code === "SCHEMA_INVALID" ? "SCHEMA_INVALID" : "ERROR",
      httpStatus: null,
      durationMs: 0,
      errorCode: err?.code || "CONNECTOR_CONFIG_INVALID",
      bodyText: String(err?.message || "Connector configuration invalid").slice(0, 200),
      truncated: false,
      retried: false,
    };
  }

  const shopifyCredential = {
    ...credential,
    type: "API_KEY_HEADER",
    headerName: SHOPIFY_ACCESS_TOKEN_HEADER,
  };

  const result = await executeHttpAction({
    dispatchSignal: signal,
    onDispatch,
    method: request.method,
    urlTemplate: request.urlTemplate,
    headersJson: request.headersJson,
    args: request.args,
    timeoutMs,
    allowLocalDemo: false,
    retryOnce: true,
    credential: shopifyCredential,
    frozenHost: request.frozenHost,
    idempotent: true,
    riskLevel: "READ",
    guestResponseCap,
  });

  const scrubbed = scrubSecretsFromResult(result, [credential.plaintext]);
  if (scrubbed?.ok && scrubbed.bodyText) {
    const ownership = assertShopifyOrderBelongsToCustomer(scrubbed.bodyText, {
      customerSubject,
      customerClaims,
    });
    if (!ownership.ok) {
      return {
        ok: false,
        status: "ERROR",
        httpStatus: 403,
        durationMs: scrubbed.durationMs || 0,
        errorCode: ownership.code,
        bodyText: ownership.message,
        truncated: false,
        retried: Boolean(scrubbed.retried),
      };
    }
    scrubbed.bodyText = projectShopifyOrderForModel(ownership.bodyText);
    return scrubSecretsFromResult(scrubbed, [credential.plaintext]);
  }
  return scrubbed;
}

/**
 * True when this action should use the Shopify Admin connector (not the example.com template).
 */
export function canUseShopifyAdminConnector({ action, connection, credential }) {
  if (String(action?.name || "") !== "shopify_get_order") return false;
  if (!credential?.plaintext) return false;
  return Boolean(
    resolveShopifyShopOriginFromContext({ connection, action })
  );
}
