/**
 * Pack / vertical install connection status.
 * Install creates starter AgentActions — never a live connector session.
 * Use relative imports so Node smoke scripts can load this without @/ aliases.
 */

import { isDemoIntegrationUrl } from "../embed/readiness.js";

/** @typedef {"template" | "unverified"} PackConnectionStatus */

export const PACK_CONNECTION_STATUS = Object.freeze({
  /** Demo, localhost, or example.* starter URLs — not a merchant connector. */
  TEMPLATE: "template",
  /** Non-demo URL present, but credential+host probe has not certified live. */
  UNVERIFIED: "unverified",
});

/**
 * Owner-facing label. Never returns "Connected" / "Live".
 * @param {PackConnectionStatus | string} status
 */
export function connectionStatusLabel(status) {
  if (status === PACK_CONNECTION_STATUS.TEMPLATE) return "Template";
  if (status === PACK_CONNECTION_STATUS.UNVERIFIED) return "Not connected";
  return "Not connected";
}

/**
 * @param {string} url
 * @returns {PackConnectionStatus}
 */
export function classifyUrlConnectionStatus(url) {
  return isDemoIntegrationUrl(url)
    ? PACK_CONNECTION_STATUS.TEMPLATE
    : PACK_CONNECTION_STATUS.UNVERIFIED;
}

/**
 * Aggregate status for a pack install or catalog entry.
 * Pack install alone never claims liveConnected.
 * @param {{ urls?: string[], catalogStatus?: PackConnectionStatus }} [opts]
 * @returns {PackConnectionStatus}
 */
export function summarizePackConnectionStatus({
  urls = [],
  catalogStatus = PACK_CONNECTION_STATUS.TEMPLATE,
} = {}) {
  const list = Array.isArray(urls) ? urls.filter(Boolean) : [];
  if (!list.length) {
    return catalogStatus === PACK_CONNECTION_STATUS.UNVERIFIED
      ? PACK_CONNECTION_STATUS.UNVERIFIED
      : PACK_CONNECTION_STATUS.TEMPLATE;
  }
  if (list.some((u) => isDemoIntegrationUrl(u))) {
    return PACK_CONNECTION_STATUS.TEMPLATE;
  }
  return PACK_CONNECTION_STATUS.UNVERIFIED;
}

/**
 * Metadata attached to action-pack install responses and vertical catalog.
 * @param {{ packId?: string, urls?: string[], catalogStatus?: PackConnectionStatus }} [opts]
 */
export function packConnectionMeta({
  packId = null,
  urls = [],
  catalogStatus = PACK_CONNECTION_STATUS.TEMPLATE,
} = {}) {
  const connectionStatus = summarizePackConnectionStatus({ urls, catalogStatus });
  return {
    packId: packId || null,
    connectionStatus,
    connectionStatusLabel: connectionStatusLabel(connectionStatus),
    isTemplate: connectionStatus === PACK_CONNECTION_STATUS.TEMPLATE,
    /** Pack install never establishes a live merchant connection. */
    liveConnected: false,
  };
}
