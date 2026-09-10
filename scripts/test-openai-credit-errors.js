import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(new URL("../lib/services/ai/openai-errors.js", import.meta.url), "utf8");
assert.match(source, /insufficient_quota/);
assert.match(source, /billing_not_active/);
assert.match(source, /credit_balance_exhausted/);

const { normalizeOpenAiError } = await import("../lib/services/ai/openai-errors.js");
assert.deepEqual(normalizeOpenAiError({ code: "insufficient_quota", status: 429 }), {
  status: 402,
  message: "AI credits are unavailable. Add credits or configure a funded OpenAI API key, then try again.",
  code: "credit_balance_exhausted",
});
assert.equal(normalizeOpenAiError({ code: "invalid_api_key", status: 401 }), null);
console.log("OpenAI credit error mapping passed");
