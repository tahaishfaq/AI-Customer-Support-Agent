const LEVELS = { error: 0, warn: 1, info: 2 };

/** Keys allowed in structured meta — never log transcripts, prompts, emails, bodies. */
const ALLOWED_META = new Set([
  "requestId",
  "agentId",
  "conversationId",
  "jobId",
  "route",
  "status",
  "code",
  "durationMs",
  "pagesCrawled",
  "sampled",
]);

function currentLevel() {
  const raw = (process.env.LOG_LEVEL || "info").toLowerCase();
  return LEVELS[raw] ?? LEVELS.info;
}

function sanitizeMeta(meta = {}) {
  const out = {};
  for (const key of ALLOWED_META) {
    if (meta[key] != null && meta[key] !== "") {
      out[key] = meta[key];
    }
  }
  return out;
}

/**
 * Structured log without PII/chat content.
 * @param {"error"|"warn"|"info"} level
 * @param {string} message Short ops message only
 * @param {Record<string, unknown>} [meta]
 */
export function safeLog(level, message, meta = {}) {
  const rank = LEVELS[level];
  if (rank == null || rank > currentLevel()) return;

  const payload = {
    level,
    msg: String(message || "").slice(0, 500),
    ts: new Date().toISOString(),
    ...sanitizeMeta(meta),
  };

  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function safeLogError(message, meta) {
  safeLog("error", message, meta);
}

export function safeLogWarn(message, meta) {
  safeLog("warn", message, meta);
}

export function safeLogInfo(message, meta) {
  safeLog("info", message, meta);
}

/**
 * Success-path chat/ops logs — off by default to cap volume.
 * Enable with LOG_CHAT_SUCCESS=1, or sample via LOG_INFO_SAMPLE_RATE=0.01 (0–1).
 * Errors/warns always use safeLogError / safeLogWarn (never sampled).
 */
export function safeLogInfoSampled(message, meta = {}) {
  if (process.env.LOG_CHAT_SUCCESS === "1") {
    safeLogInfo(message, { ...meta, sampled: false });
    return;
  }
  const rate = Number(process.env.LOG_INFO_SAMPLE_RATE);
  if (!Number.isFinite(rate) || rate <= 0) return;
  if (Math.random() > Math.min(1, rate)) return;
  safeLogInfo(message, { ...meta, sampled: true });
}
