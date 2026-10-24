/**
 * AIDE-GAP-002 — Tool / action / chat limit SSOT.
 *
 * RAW NETWORK BYTES
 *   != POST-PROCESS HTTP BODY (to gateway)
 *   != LLM-VISIBLE TOOL RESULT (orchestrator fence)
 *
 * Do not collapse 1MB / 8k / 4k into one number.
 */

/** Soft cap for LLM tool rounds per chat turn. */
export const MAX_TOOL_STEPS = 3;

/** Soft ceiling for the whole tool loop under a chat request (ms). */
export const TOOL_LOOP_DEADLINE_MS = 25_000;

/** Max parallel outbound HTTP action calls per agent (per instance). */
export const MAX_CONCURRENT_OUTBOUND = 2;
export const MAX_CONCURRENT_OUTBOUND_CALLS = MAX_CONCURRENT_OUTBOUND;

/** Default per-action HTTP timeout (ms). */
export const DEFAULT_HTTP_TIMEOUT_MS = 8000;
export const DEFAULT_ACTION_TIMEOUT_MS = DEFAULT_HTTP_TIMEOUT_MS;

/** Soft ceiling for any single action timeout (ms). */
export const MAX_ACTION_TIMEOUT_MS = 15_000;

/** Hosted OpenAI web_search wall clock (ms). */
export const HOSTED_WEB_SEARCH_TIMEOUT_MS = 12_000;

/** Wire read budget before cancel (bytes). */
export const MAX_UPSTREAM_RESPONSE_BYTES = 1_048_576;

/** Post-projection / sanitized HTTP body chars passed toward the model gateway. */
export const MAX_HTTP_PROCESSED_RESPONSE_CHARS = 8000;
/** @deprecated alias — same as MAX_HTTP_PROCESSED_RESPONSE_CHARS */
export const MAX_RESPONSE_CHARS = MAX_HTTP_PROCESSED_RESPONSE_CHARS;

/** Guest / public embed tighter HTTP body cap. */
export const MAX_PUBLIC_HTTP_PROCESSED_RESPONSE_CHARS = 1200;
/** @deprecated alias */
export const MAX_GUEST_RESPONSE_CHARS = MAX_PUBLIC_HTTP_PROCESSED_RESPONSE_CHARS;

/** Orchestrator: LLM-visible tool result content (chars) before/within fence. */
export const MAX_LLM_TOOL_RESULT_CHARS = 4000;

/** Knowledge stuffing budget (chars). */
export const MAX_KNOWLEDGE_CHARS = 12_000;

/** Chat history messages offered to the model. */
export const MAX_HISTORY_MESSAGES = 20;

/** WRITE confirmation TTL (ms). */
export const DEFAULT_CONFIRMATION_TTL_MS = 10 * 60 * 1000;

/** WRITE idempotency lease / replay TTL (ms). */
export const DEFAULT_WRITE_IDEMPOTENCY_TTL_MS = 15 * 60 * 1000;

/** Frozen expected values for drift tests. */
export const LIMITS_CONTRACT = Object.freeze({
  MAX_UPSTREAM_RESPONSE_BYTES: 1_048_576,
  MAX_HTTP_PROCESSED_RESPONSE_CHARS: 8000,
  MAX_PUBLIC_HTTP_PROCESSED_RESPONSE_CHARS: 1200,
  MAX_LLM_TOOL_RESULT_CHARS: 4000,
  MAX_KNOWLEDGE_CHARS: 12_000,
  MAX_HISTORY_MESSAGES: 20,
  MAX_TOOL_STEPS: 3,
  TOOL_LOOP_DEADLINE_MS: 25_000,
  MAX_CONCURRENT_OUTBOUND_CALLS: 2,
  DEFAULT_HTTP_TIMEOUT_MS: 8000,
  HOSTED_WEB_SEARCH_TIMEOUT_MS: 12_000,
  DEFAULT_CONFIRMATION_TTL_MS: 10 * 60 * 1000,
  DEFAULT_WRITE_IDEMPOTENCY_TTL_MS: 15 * 60 * 1000,
});
