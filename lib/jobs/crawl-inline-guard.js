/**
 * Process-local guards for inline (non-BullMQ) crawl runners.
 * - Per-agent mutex so concurrent after() hooks do not overlap on one agent
 * - Global Chromium slot (max 1) when CRAWL_BROWSER_ENABLED to avoid Starter OOM
 */

const agentLocks = new Map();
let browserSlotsInUse = 0;
const MAX_BROWSER_SLOTS = 1;

export function tryAcquireInlineAgentLock(agentId) {
  const id = String(agentId || "").trim();
  if (!id) return false;
  if (agentLocks.has(id)) return false;
  agentLocks.set(id, Date.now());
  return true;
}

export function releaseInlineAgentLock(agentId) {
  const id = String(agentId || "").trim();
  if (!id) return;
  agentLocks.delete(id);
}

export function tryAcquireBrowserCrawlSlot() {
  if (browserSlotsInUse >= MAX_BROWSER_SLOTS) return false;
  browserSlotsInUse += 1;
  return true;
}

export function releaseBrowserCrawlSlot() {
  browserSlotsInUse = Math.max(0, browserSlotsInUse - 1);
}

export function __resetInlineCrawlGuardsForTests() {
  agentLocks.clear();
  browserSlotsInUse = 0;
}
