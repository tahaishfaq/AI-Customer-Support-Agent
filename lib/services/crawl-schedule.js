/** Allowed website re-crawl intervals (hours). 0 = one-time only (default). */
export const CRAWL_RECRAWL_OPTIONS = [
  { value: 0, label: "Once only (default)" },
  { value: 24, label: "Every 24 hours" },
  { value: 72, label: "Every 3 days" },
  { value: 168, label: "Weekly" },
  { value: 720, label: "Monthly (~30 days)" },
];

const ALLOWED_HOURS = new Set(CRAWL_RECRAWL_OPTIONS.map((o) => o.value));

export function normalizeCrawlRecrawlHours(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || !ALLOWED_HOURS.has(n)) return 0;
  return n;
}

export function labelForCrawlRecrawlHours(hours) {
  const match = CRAWL_RECRAWL_OPTIONS.find((o) => o.value === hours);
  return match?.label || CRAWL_RECRAWL_OPTIONS[0].label;
}

/**
 * True when agent has a schedule and last crawl is older than the interval.
 * @param {{ crawlRecrawlHours?: number|null, siteCrawledAt?: Date|string|null }} agent
 * @param {Date} [now]
 */
export function isRecrawlDue(agent, now = new Date()) {
  const hours = normalizeCrawlRecrawlHours(agent?.crawlRecrawlHours ?? 0);
  if (hours <= 0) return false;
  if (!agent?.siteCrawledAt) return false;
  const last = new Date(agent.siteCrawledAt);
  if (Number.isNaN(last.getTime())) return false;
  return now.getTime() - last.getTime() >= hours * 60 * 60 * 1000;
}

/** Human hint for UI — when the next scheduled recrawl becomes eligible. */
export function nextRecrawlAt(agent, now = new Date()) {
  const hours = normalizeCrawlRecrawlHours(agent?.crawlRecrawlHours ?? 0);
  if (hours <= 0 || !agent?.siteCrawledAt) return null;
  const last = new Date(agent.siteCrawledAt);
  if (Number.isNaN(last.getTime())) return null;
  return new Date(last.getTime() + hours * 60 * 60 * 1000);
}

export function isRecrawlEligibleAt(nextAt, now = new Date()) {
  if (!nextAt) return false;
  const at = nextAt instanceof Date ? nextAt : new Date(nextAt);
  if (Number.isNaN(at.getTime())) return false;
  return now.getTime() >= at.getTime();
}
