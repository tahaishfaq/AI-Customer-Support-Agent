/**
 * F11 Phase D — error handling (retry, safe model payloads, no PII logs).
 * Run: npm run test:f11e
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatToolResultForModel,
  isRetryableHttpStatus,
  safeToolErrorMessage,
  shouldRetryHttpAction,
} from "../lib/actions/tool-errors.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function testDocScope() {
  const f11 = read("docs/features/F11_AGENT_ACTIONS.md");
  assert(/Phase D — Error handling ✅/.test(f11), "F11 Phase D marked done");
  console.log("ok  F11-E doc scope");
}

function testSourceWiring() {
  assert(exists("lib/actions/tool-errors.js"), "tool-errors helper");
  const http = read("lib/actions/http-executor.js");
  assert(/shouldRetryHttpAction/.test(http), "executor uses retry helper");
  assert(/retryOnce/.test(http), "executor retryOnce option");

  const loop = read("lib/actions/tool-loop.js");
  assert(/formatToolResultForModel/.test(loop), "loop formats model payloads");
  assert(/tool\.run/.test(loop), "safe tool.run log");

  const safeLog = read("lib/observability/safe-log.js");
  assert(/actionName/.test(safeLog), "safe-log allows actionName");
  assert(!/bodyText|transcript|prompt/.test(
    safeLog.match(/ALLOWED_META[\s\S]*?\];/)?.[0] || ""
  ), "safe-log allowlist has no body/transcript");

  console.log("ok  F11-E source wiring");
}

function testRetryRules() {
  assert(isRetryableHttpStatus(500));
  assert(isRetryableHttpStatus(503));
  assert(!isRetryableHttpStatus(404));
  assert(!isRetryableHttpStatus(400));

  assert(
    shouldRetryHttpAction({ ok: false, status: "TIMEOUT", errorCode: "TIMEOUT" }),
    "timeout retries"
  );
  assert(
    shouldRetryHttpAction({
      ok: false,
      status: "ERROR",
      httpStatus: 502,
      errorCode: "HTTP_502",
    }),
    "5xx retries"
  );
  assert(
    shouldRetryHttpAction({
      ok: false,
      status: "ERROR",
      errorCode: "FETCH_ERROR",
    }),
    "fetch error retries"
  );
  assert(
    !shouldRetryHttpAction({
      ok: false,
      status: "ERROR",
      httpStatus: 404,
      errorCode: "HTTP_404",
    }),
    "4xx no retry"
  );
  assert(
    !shouldRetryHttpAction({
      ok: false,
      status: "SSRF_BLOCKED",
      errorCode: "SSRF_BLOCKED",
    }),
    "SSRF no retry"
  );
  assert(!shouldRetryHttpAction({ ok: true, status: "OK", httpStatus: 200 }));

  console.log("ok  F11-E retry rules");
}

function testModelPayloads() {
  const ok = JSON.parse(
    formatToolResultForModel({
      ok: true,
      httpStatus: 200,
      bodyText: '{"status":"Shipped"}',
      truncated: false,
    })
  );
  assert(ok.ok && ok.body.includes("Shipped"), "ok body passed");

  const four = JSON.parse(
    formatToolResultForModel({
      ok: false,
      status: "ERROR",
      httpStatus: 404,
      errorCode: "HTTP_404",
      bodyText: "order not found for customer secret@example.com",
    })
  );
  assert(!four.ok && four.detail, "4xx includes short detail");
  assert(four.error, "4xx has safe error");

  const five = JSON.parse(
    formatToolResultForModel({
      ok: false,
      status: "ERROR",
      httpStatus: 500,
      errorCode: "HTTP_500",
      bodyText: "<html>huge stack with emails</html>",
    })
  );
  assert(!five.detail, "5xx omits raw body from model payload");
  assert(/unavailable|try again/i.test(five.error), "5xx apology guidance");

  const timeoutMsg = safeToolErrorMessage({
    status: "TIMEOUT",
    errorCode: "TIMEOUT",
  });
  assert(/timed out/i.test(timeoutMsg), "timeout message");

  console.log("ok  F11-E model payloads");
}

function main() {
  testDocScope();
  testSourceWiring();
  testRetryRules();
  testModelPayloads();
  console.log("\nAll F11-E checks passed.");
}

main();
