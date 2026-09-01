/**
 * O01 Phase O0 — contract fixtures + policy map (no runtime chat change).
 * Run: npm run test:orchestrator-o0
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ok,
  denied,
  needsUser,
  errorResult,
  escalate,
  validateCapabilityResult,
  CAPABILITY_STATUSES,
} from "../lib/capabilities/result.js";
import {
  mapPolicyCodeToCapability,
  POLICY_CODE_MAP,
} from "../lib/orchestrator/map-policy.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturesDir = path.join(root, "scripts/fixtures/orchestrator");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function testFilesExist() {
  const files = [
    "docs/features/ORCHESTRATOR_CONTRACT.md",
    "docs/features/ORCHESTRATOR_LAYER_PLAN.md",
    "lib/capabilities/result.js",
    "lib/orchestrator/map-policy.js",
  ];
  for (const f of files) {
    assert(fs.existsSync(path.join(root, f)), `missing ${f}`);
  }
  console.log("ok  O0 files exist");
}

function testFixturesValidate() {
  const names = [
    "capability-result-ok.json",
    "capability-result-denied.json",
    "capability-result-needs-user.json",
    "capability-result-error.json",
    "capability-result-escalate.json",
  ];
  const seen = new Set();
  for (const name of names) {
    const raw = fs.readFileSync(path.join(fixturesDir, name), "utf8");
    const data = JSON.parse(raw);
    const v = validateCapabilityResult(data);
    assert(v.ok, `${name}: ${v.error}`);
    seen.add(data.status);
  }
  for (const s of CAPABILITY_STATUSES) {
    assert(seen.has(s), `missing fixture for status=${s}`);
  }
  console.log("ok  fixtures validate (all 5 statuses)");
}

function testHelpersRoundtrip() {
  const samples = [
    ok({
      forModel: "hi",
      meta: { capabilityId: "c1", latencyMs: 1 },
    }),
    denied({
      code: "CROSS_USER_DENIED",
      forModel: "no",
      meta: { capabilityId: "c1", latencyMs: 0 },
    }),
    needsUser({
      code: "CONFIRMATION_REQUIRED",
      forModel: "wait",
      forClient: { type: "confirm", payload: { id: "x" } },
      meta: { capabilityId: "c1", latencyMs: 2 },
    }),
    errorResult({
      code: "HTTP_ERROR",
      forModel: "err",
      meta: { capabilityId: "c1", latencyMs: 9, httpStatus: 500 },
    }),
    escalate({
      forModel: "desk",
      meta: { capabilityId: "builtin", latencyMs: 1 },
    }),
  ];
  for (const s of samples) {
    const v = validateCapabilityResult(s);
    assert(v.ok, `helper invalid: ${v.error}`);
  }
  console.log("ok  helpers produce valid envelopes");
}

function testPolicyMapTable() {
  const cases = [
    ["CONFIRMATION_REQUIRED", "needs_user", "confirm"],
    ["IDENTITY_REQUIRED", "needs_user", "login"],
    ["END_USER_TOKEN_REQUIRED", "needs_user", "login"],
    ["CROSS_USER_DENIED", "denied", "none"],
    ["SCHEMA_INVALID", "error", "none"],
    ["HANDOFF", "escalate", "handoff"],
    [null, "ok", "data"], // httpOk path
  ];
  for (const [code, status, clientType] of cases) {
    const mapped =
      code == null
        ? mapPolicyCodeToCapability(null, { httpOk: true })
        : mapPolicyCodeToCapability(code);
    assert(
      mapped.status === status,
      `${code}: expected status ${status}, got ${mapped.status}`
    );
    assert(
      mapped.clientType === clientType,
      `${code}: expected clientType ${clientType}, got ${mapped.clientType}`
    );
  }
  assert(
    Object.keys(POLICY_CODE_MAP).length >= 10,
    "POLICY_CODE_MAP should cover known codes"
  );
  const unknown = mapPolicyCodeToCapability("TOTALLY_NEW_CODE");
  assert(unknown.status === "error", "unknown codes fail closed as error");
  console.log("ok  policy code → CapabilityResult map");
}

function testRejectBadShapes() {
  const bad = [
    null,
    {},
    { status: "ok" },
    {
      status: "weird",
      code: "X",
      forModel: "",
      forClient: null,
      meta: { capabilityId: "a", latencyMs: 0 },
    },
    {
      status: "ok",
      code: "OK",
      forModel: "",
      forClient: { type: "banana" },
      meta: { capabilityId: "a", latencyMs: 0 },
    },
  ];
  for (const b of bad) {
    assert(!validateCapabilityResult(b).ok, "expected invalid");
  }
  console.log("ok  reject invalid shapes");
}

function main() {
  console.log("\n=== Orchestrator O0 ===\n");
  testFilesExist();
  testFixturesValidate();
  testHelpersRoundtrip();
  testPolicyMapTable();
  testRejectBadShapes();
  console.log("\nO0 PASS\n");
}

main();
