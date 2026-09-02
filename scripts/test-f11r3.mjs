/**
 * F11 redesign R3 smoke — retry policy, frozen host, output cap, SSRF pin.
 * Run: npm run test:f11r3
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { shouldRetryHttpAction } from "../lib/actions/tool-errors.js";
import { assertFrozenHostMatch, extractFrozenHost } from "../lib/actions/frozen-host.js";
import {
  MAX_RESPONSE_CHARS,
  validateOutputAgainstSchema,
} from "../lib/actions/http-executor.js";
import { assertActionUrlSafePinned } from "../lib/actions/ssrf.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function testRetryReadVsWrite() {
  const timeout = { ok: false, status: "TIMEOUT", errorCode: "TIMEOUT" };
  assert(
    shouldRetryHttpAction(timeout, { method: "GET", riskLevel: "READ" }),
    "READ timeout retries"
  );
  assert(
    !shouldRetryHttpAction(timeout, {
      method: "POST",
      riskLevel: "WRITE",
      idempotent: false,
    }),
    "WRITE non-idempotent no retry"
  );
  assert(
    shouldRetryHttpAction(timeout, {
      method: "POST",
      riskLevel: "WRITE",
      idempotent: true,
    }),
    "WRITE idempotent can retry (candidate)"
  );
  console.log("ok  shouldRetry READ vs WRITE");
}

function testFrozenHost() {
  const host = extractFrozenHost("https://api.example.com/orders/{{id}}");
  assert(host === "api.example.com", "extract frozen host");
  assertFrozenHostMatch("https://api.example.com/orders/1", host);
  let threw = false;
  try {
    assertFrozenHostMatch("https://evil.example.com/x", host);
  } catch {
    threw = true;
  }
  assert(threw, "frozen host mismatch blocked");
  console.log("ok  frozen host");
}

function testOutputCap() {
  assert(MAX_RESPONSE_CHARS === 8000, "MAX_RESPONSE_CHARS");
  const ok = validateOutputAgainstSchema(
    JSON.stringify({ id: "1", status: "ok" }),
    { id: "string", status: "string" }
  );
  assert(ok.ok, "output schema keys present");
  const bad = validateOutputAgainstSchema(JSON.stringify({ id: "1" }), {
    id: "string",
    status: "string",
  });
  assert(!bad.ok, "missing key rejected");
  console.log("ok  output cap constants");
}

function testSsrfPinExport() {
  assert(typeof assertActionUrlSafePinned === "function", "pin function exported");
  const ssrf = fs.readFileSync(
    path.join(root, "lib/actions/ssrf.js"),
    "utf8"
  );
  assert(/dns\.promises\.lookup|dnsLookup/.test(ssrf), "uses dns lookup");
  assert(/all:\s*true/.test(ssrf), "lookup all addresses");
  console.log("ok  SSRF pin function exists/exports");
}

function testFiles() {
  assert(exists("lib/actions/ssrf.js"));
  assert(exists("lib/actions/http-executor.js"));
  console.log("ok  R3 files");
}

function main() {
  testFiles();
  testRetryReadVsWrite();
  testFrozenHost();
  testOutputCap();
  testSsrfPinExport();
  console.log("\nF11-R3 smoke passed");
}

try {
  main();
} catch (error) {
  console.error("\nF11-R3 smoke FAILED:", error.message);
  process.exit(1);
}
