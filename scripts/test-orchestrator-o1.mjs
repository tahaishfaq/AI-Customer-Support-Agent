/**
 * O01 Phase O1 — tool-step → CapabilityResult adapter (behavior-preserving).
 * Run: npm run test:orchestrator-o1
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  capabilityResultFromToolStep,
  withCapabilityResult,
} from "../lib/capabilities/from-tool-step.js";
import { validateCapabilityResult } from "../lib/capabilities/result.js";
import { TOOL_RUN_STATUS } from "../lib/actions/action-config.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function testFiles() {
  for (const f of [
    "lib/capabilities/from-tool-step.js",
    "lib/actions/invoke-tool.js",
    "lib/actions/tool-loop.js",
  ]) {
    assert(fs.existsSync(path.join(root, f)), `missing ${f}`);
  }
  const invoke = fs.readFileSync(
    path.join(root, "lib/actions/invoke-tool.js"),
    "utf8"
  );
  assert(
    /withCapabilityResult/.test(invoke),
    "invoke-tool must wrap steps with withCapabilityResult"
  );
  console.log("ok  O1 files + invoke-tool wired");
}

function testConfirmMapsNeedsUser() {
  const step = {
    name: "cancel_order",
    status: TOOL_RUN_STATUS.ERROR,
    errorCode: "CONFIRMATION_REQUIRED",
    durationMs: 2,
    resultForModel: "wait for confirm",
    pendingConfirmation: {
      id: "conf_1",
      actionName: "cancel_order",
    },
  };
  const cr = capabilityResultFromToolStep(step);
  assert(validateCapabilityResult(cr).ok, "valid envelope");
  assert(cr.status === "needs_user", `status=${cr.status}`);
  assert(cr.code === "CONFIRMATION_REQUIRED", `code=${cr.code}`);
  assert(cr.forClient?.type === "confirm", "confirm client");
  assert(cr.forClient?.payload?.id === "conf_1", "payload preserved");
  assert(cr.forModel === step.resultForModel, "forModel unchanged");
  console.log("ok  CONFIRMATION_REQUIRED → needs_user + confirm");
}

function testIdentityLogin() {
  for (const code of ["IDENTITY_REQUIRED", "END_USER_TOKEN_REQUIRED"]) {
    const cr = capabilityResultFromToolStep({
      name: "get_order",
      status: TOOL_RUN_STATUS.ERROR,
      errorCode: code,
      durationMs: 0,
      resultForModel: "sign in",
    });
    assert(cr.status === "needs_user", `${code} status`);
    assert(cr.forClient?.type === "login", `${code} login`);
  }
  console.log("ok  identity codes → needs_user + login");
}

function testCrossUserDenied() {
  const cr = capabilityResultFromToolStep({
    name: "get_order",
    status: TOOL_RUN_STATUS.ERROR,
    errorCode: "CROSS_USER_DENIED",
    durationMs: 0,
    resultForModel: "refuse",
  });
  assert(cr.status === "denied", "denied");
  assert(cr.forClient?.type === "none", "no client action");
  console.log("ok  CROSS_USER_DENIED → denied");
}

function testHttpOk() {
  const cr = capabilityResultFromToolStep({
    name: "get_order",
    status: TOOL_RUN_STATUS.OK,
    errorCode: null,
    httpStatus: 200,
    durationMs: 40,
    resultForModel: '{"ok":true}',
  });
  assert(cr.status === "ok", "ok");
  assert(cr.forClient?.type === "data", "data client");
  console.log("ok  HTTP OK → ok + data");
}

function testWithCapabilityAdditive() {
  const step = {
    name: "x",
    status: TOOL_RUN_STATUS.OK,
    httpStatus: 200,
    durationMs: 1,
    resultForModel: "body",
  };
  const out = withCapabilityResult(step);
  assert(out.resultForModel === "body", "legacy field kept");
  assert(out.name === "x", "name kept");
  assert(out.capabilityResult?.status === "ok", "envelope attached");
  console.log("ok  withCapabilityResult is additive");
}

function main() {
  console.log("\n=== Orchestrator O1 ===\n");
  testFiles();
  testConfirmMapsNeedsUser();
  testIdentityLogin();
  testCrossUserDenied();
  testHttpOk();
  testWithCapabilityAdditive();
  console.log("\nO1 PASS\n");
}

main();
