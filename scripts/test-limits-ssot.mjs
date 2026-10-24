/**
 * AIDE-GAP-002 — limits SSOT drift guard.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  LIMITS_CONTRACT,
  MAX_UPSTREAM_RESPONSE_BYTES,
  MAX_HTTP_PROCESSED_RESPONSE_CHARS,
  MAX_PUBLIC_HTTP_PROCESSED_RESPONSE_CHARS,
  MAX_LLM_TOOL_RESULT_CHARS,
  MAX_KNOWLEDGE_CHARS,
  MAX_HISTORY_MESSAGES,
  MAX_TOOL_STEPS,
  TOOL_LOOP_DEADLINE_MS,
  MAX_CONCURRENT_OUTBOUND_CALLS,
  DEFAULT_HTTP_TIMEOUT_MS,
  HOSTED_WEB_SEARCH_TIMEOUT_MS,
  DEFAULT_CONFIRMATION_TTL_MS,
  DEFAULT_WRITE_IDEMPOTENCY_TTL_MS,
} from "../lib/actions/limits.js";
import {
  MAX_TOOL_STEPS as CFG_STEPS,
  TOOL_LOOP_DEADLINE_MS as CFG_DEADLINE,
  MAX_CONCURRENT_OUTBOUND as CFG_OUTBOUND,
  DEFAULT_ACTION_TIMEOUT_MS as CFG_TIMEOUT,
} from "../lib/actions/action-config.js";
import {
  MAX_RESPONSE_CHARS,
  MAX_GUEST_RESPONSE_CHARS,
  MAX_UPSTREAM_RESPONSE_BYTES as EXEC_BYTES,
} from "../lib/actions/http-executor.js";

for (const [key, expected] of Object.entries(LIMITS_CONTRACT)) {
  const actual = {
    MAX_UPSTREAM_RESPONSE_BYTES,
    MAX_HTTP_PROCESSED_RESPONSE_CHARS,
    MAX_PUBLIC_HTTP_PROCESSED_RESPONSE_CHARS,
    MAX_LLM_TOOL_RESULT_CHARS,
    MAX_KNOWLEDGE_CHARS,
    MAX_HISTORY_MESSAGES,
    MAX_TOOL_STEPS,
    TOOL_LOOP_DEADLINE_MS,
    MAX_CONCURRENT_OUTBOUND_CALLS,
    DEFAULT_HTTP_TIMEOUT_MS,
    HOSTED_WEB_SEARCH_TIMEOUT_MS,
    DEFAULT_CONFIRMATION_TTL_MS,
    DEFAULT_WRITE_IDEMPOTENCY_TTL_MS,
  }[key];
  assert.equal(actual, expected, `${key} drifted`);
}

assert.equal(CFG_STEPS, MAX_TOOL_STEPS);
assert.equal(CFG_DEADLINE, TOOL_LOOP_DEADLINE_MS);
assert.equal(CFG_OUTBOUND, MAX_CONCURRENT_OUTBOUND_CALLS);
assert.equal(CFG_TIMEOUT, DEFAULT_HTTP_TIMEOUT_MS);
assert.equal(MAX_RESPONSE_CHARS, MAX_HTTP_PROCESSED_RESPONSE_CHARS);
assert.equal(MAX_GUEST_RESPONSE_CHARS, MAX_PUBLIC_HTTP_PROCESSED_RESPONSE_CHARS);
assert.equal(EXEC_BYTES, MAX_UPSTREAM_RESPONSE_BYTES);

const root = path.join(import.meta.dirname, "..");
for (const rel of [
  "lib/actions/untrusted-result.js",
  "lib/actions/execution-envelope.js",
  "lib/mcp/client.js",
  "lib/services/ai/llm.provider.js",
]) {
  const src = fs.readFileSync(path.join(root, rel), "utf8");
  assert.match(src, /MAX_LLM_TOOL_RESULT_CHARS|HOSTED_WEB_SEARCH_TIMEOUT_SSOT|HOSTED_WEB_SEARCH_TIMEOUT_MS/);
}

// Semantic distinction: raw network != processed HTTP != LLM-visible
assert.ok(MAX_UPSTREAM_RESPONSE_BYTES > MAX_HTTP_PROCESSED_RESPONSE_CHARS);
assert.ok(MAX_HTTP_PROCESSED_RESPONSE_CHARS > MAX_LLM_TOOL_RESULT_CHARS);
assert.ok(MAX_LLM_TOOL_RESULT_CHARS > MAX_PUBLIC_HTTP_PROCESSED_RESPONSE_CHARS);

console.log("ok  limits SSOT contract");
