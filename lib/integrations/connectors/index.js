/**
 * Managed connector gateway — wraps http-executor for allowlisted actions.
 */

import { resolveConnectorId, CONNECTOR_IDS } from "./types.js";
import {
  canUseShopifyAdminConnector,
  executeShopifyGetOrder,
  resolveShopifyShopOriginFromContext,
} from "./shopify-admin.js";

/**
 * Try a managed connector. Returns { handled: false } to fall through to generic HTTP.
 * @param {{
 *   action: object,
 *   args: Record<string, unknown>,
 *   credential: object|null,
 *   connection: object|null,
 *   executeHttpAction: Function,
 *   timeoutMs?: number,
 *   allowLocalDemo?: boolean,
 *   guestResponseCap?: boolean,
 *   signal?: AbortSignal,
 *   onDispatch?: Function,
 * }} ctx
 * @returns {Promise<{ handled: false } | { handled: true, connectorId: string, result: object }>}
 */
export async function tryExecuteManagedConnector(ctx) {
  const connectorId = resolveConnectorId(ctx.action);
  if (!connectorId) return { handled: false };

  if (connectorId === CONNECTOR_IDS.SHOPIFY_ADMIN) {
    if (
      !canUseShopifyAdminConnector({
        action: ctx.action,
        connection: ctx.connection,
        credential: ctx.credential,
      })
    ) {
      return { handled: false };
    }

    const shopOrigin = resolveShopifyShopOriginFromContext({
      connection: ctx.connection,
      action: ctx.action,
    });

    const result = await executeShopifyGetOrder({
      orderId: String(ctx.args?.orderId ?? ""),
      shopOrigin,
      credential: ctx.credential,
      executeHttpAction: ctx.executeHttpAction,
      timeoutMs: ctx.timeoutMs,
      allowLocalDemo: false,
      guestResponseCap: ctx.guestResponseCap,
      signal: ctx.signal,
      onDispatch: ctx.onDispatch,
    });

    return {
      handled: true,
      connectorId,
      result,
    };
  }

  return { handled: false };
}

export {
  CONNECTOR_IDS,
  resolveConnectorId,
  ACTION_CONNECTOR_BY_NAME,
  scrubSecretsFromResult,
} from "./types.js";
export {
  SHOPIFY_ADMIN_API_VERSION,
  SHOPIFY_ACCESS_TOKEN_HEADER,
  isShopifyAdminHostname,
  normalizeShopifyShopOrigin,
  resolveShopifyShopOriginFromContext,
  buildShopifyGetOrderRequest,
  projectShopifyOrderForModel,
  executeShopifyGetOrder,
  canUseShopifyAdminConnector,
} from "./shopify-admin.js";
