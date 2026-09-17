/**
 * Connection wizard helpers — build credential + connection payloads.
 * Secrets are never stored on IntegrationConnection; only credentialId refs.
 * Client-safe (no Prisma). Use relative imports for Node smoke tests.
 */

import {
  SHOPIFY_ACCESS_TOKEN_HEADER,
  normalizeShopifyShopOrigin,
} from "./connectors/shopify-admin.js";

/**
 * Owner-facing credential fields that APIs may return. Never ciphertext/plaintext.
 */
export const CREDENTIAL_OWNER_FIELDS = Object.freeze([
  "id",
  "workspaceId",
  "name",
  "type",
  "headerName",
  "keyVersion",
  "revokedAt",
  "lastRotatedAt",
  "createdAt",
  "updatedAt",
  "hasSecret",
]);

/**
 * @param {unknown} payload
 * @returns {boolean}
 */
export function credentialPayloadHasPlaintext(payload) {
  if (!payload || typeof payload !== "object") return false;
  const obj = /** @type {Record<string, unknown>} */ (payload);
  if ("plaintext" in obj || "secret" in obj || "ciphertext" in obj) {
    const vals = [obj.plaintext, obj.secret, obj.ciphertext];
    return vals.some((v) => typeof v === "string" && v.length > 0);
  }
  return false;
}

/**
 * Sanitize a credential API payload for assertions / defensive UI.
 * @param {object|null} cred
 */
export function assertOwnerCredentialSafe(cred) {
  if (!cred || typeof cred !== "object") return cred;
  if (credentialPayloadHasPlaintext(cred)) {
    const err = new Error("Credential payload must not include secrets");
    err.code = "CREDENTIAL_PLAINTEXT_LEAK";
    throw err;
  }
  return cred;
}

function slugCredentialName(prefix, raw) {
  const base = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\.myshopify\.com$/i, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  const name = `${prefix}_${base || "shop"}`.replace(/_+/g, "_").slice(0, 64);
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(name)) {
    return `${prefix}_shop`;
  }
  return name;
}

/**
 * Plan a Shopify Admin API-key connection (credential ref only on connection).
 * @param {{ shop: string, environment?: string }} opts
 */
export function buildShopifyAdminConnectPlan({ shop, environment = "sandbox" }) {
  const shopOrigin = normalizeShopifyShopOrigin(shop);
  const hostname = new URL(shopOrigin).hostname;
  const slug = hostname.replace(/\.myshopify\.com$/i, "");
  const name = slugCredentialName("shopify", slug);
  return {
    connectorId: "shopify_admin",
    credential: {
      name,
      type: "API_KEY_HEADER",
      headerName: SHOPIFY_ACCESS_TOKEN_HEADER,
    },
    connection: {
      name,
      baseOrigin: shopOrigin,
      environment: environment === "production" ? "production" : "sandbox",
      // credentialId attached after credential create — never paste the secret here
    },
    actionNames: ["shopify_get_order"],
  };
}

/**
 * Strip accidental secret fields from a connection create/revision body.
 * @param {Record<string, unknown>} body
 */
export function sanitizeConnectionWriteBody(body) {
  if (!body || typeof body !== "object") return {};
  const {
    name,
    baseOrigin,
    environment,
    credentialId,
    allowedDestinations,
    headerPolicy,
    enabled,
  } = body;
  return {
    ...(name !== undefined ? { name } : {}),
    ...(baseOrigin !== undefined ? { baseOrigin } : {}),
    ...(environment !== undefined ? { environment } : {}),
    ...(credentialId !== undefined ? { credentialId: credentialId || null } : {}),
    ...(allowedDestinations !== undefined ? { allowedDestinations } : {}),
    ...(headerPolicy !== undefined ? { headerPolicy } : {}),
    ...(enabled !== undefined ? { enabled } : {}),
  };
}
