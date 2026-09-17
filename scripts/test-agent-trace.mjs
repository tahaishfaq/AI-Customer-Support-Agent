/**
 * Task 7 — Agent Trace reconstructs a turn without provider bodies.
 * Run: npm run test:agent-trace
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  TRACE_FORBIDDEN_KEYS,
  assembleAgentTurnTrace,
  assertTracePayloadSafe,
  buildActivityPhasesFromTrace,
  previewMessageContent,
} from "../lib/services/agent-trace-format.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function testPreviewAndSafety() {
  assert.equal(previewMessageContent("hi"), "hi");
  assert.ok(previewMessageContent("x".repeat(400)).endsWith("…"));
  assert.throws(
    () => assertTracePayloadSafe({ bodyText: "secret provider dump" }),
    /bodyText/
  );
  assert.throws(
    () => assertTracePayloadSafe({ resultForModel: '{"ok":true}' }),
    /resultForModel/
  );
  assert.ok(TRACE_FORBIDDEN_KEYS.includes("plaintext"));
  console.log("ok  preview + forbidden-key guard");
}

function testAssembleWithoutProviderBodies() {
  const startedAt = new Date("2026-09-16T10:00:00.000Z");
  const finishedAt = new Date("2026-09-16T10:00:02.000Z");
  const trace = assembleAgentTurnTrace({
    turn: {
      id: "turn_1",
      agentId: "agent_1",
      conversationId: "conv_1",
      workspaceId: "ws_1",
      clientMessageId: "client_1",
      requestId: "req_1",
      status: "COMPLETED",
      errorCode: null,
      ownershipVersion: 1,
      startedAt,
      finishedAt,
      lastHeartbeatAt: finishedAt,
      createdAt: startedAt,
    },
    toolRuns: [
      {
        id: "run_1",
        actionId: "act_1",
        action: { name: "shopify_get_order" },
        status: "OK",
        durationMs: 120,
        httpStatus: 200,
        errorCode: null,
        errorCategory: null,
        requestId: "req_1",
        createdAt: new Date("2026-09-16T10:00:01.000Z"),
        bodyText: "MUST_NOT_APPEAR",
        resultForModel: "MUST_NOT_APPEAR",
      },
      {
        id: "run_2",
        actionId: "act_2",
        actionName: "create_ticket",
        status: "ERROR",
        durationMs: 40,
        httpStatus: 500,
        errorCode: "FETCH_ERROR",
        errorCategory: "http",
        requestId: "req_1",
        createdAt: new Date("2026-09-16T10:00:01.500Z"),
      },
    ],
    messages: [
      {
        id: "msg_u",
        role: "USER",
        content: "Where is order 1001?",
        clientMessageId: "client_1",
        responseTime: null,
        createdAt: startedAt,
      },
      {
        id: "msg_a",
        role: "ASSISTANT",
        content: "Your order is fulfilled.",
        clientMessageId: null,
        responseTime: 900,
        createdAt: finishedAt,
      },
    ],
  });

  assert.equal(trace.meta.includesProviderBodies, false);
  assert.equal(trace.meta.reconstructed, true);
  assert.equal(trace.turn.id, "turn_1");
  assert.equal(trace.toolRuns.length, 2);
  assert.equal(trace.toolRuns[0].actionName, "shopify_get_order");
  assert.equal(trace.messages[0].contentPreview, "Where is order 1001?");
  assert.equal(trace.activities[0].activityId, "turn-accepted");
  assert.ok(trace.activities.some((a) => a.activityId === "tool-run_1"));
  assert.ok(
    trace.activities.some(
      (a) => a.activityId === "tool-run_2" && a.phase === "failed"
    )
  );
  const json = JSON.stringify(trace);
  assert.doesNotMatch(json, /MUST_NOT_APPEAR/);
  assert.doesNotMatch(json, /bodyText/);
  assert.doesNotMatch(json, /resultForModel/);
  assertTracePayloadSafe(trace);
  console.log("ok  assemble reconstructs turn without provider bodies");
}

function testActivityBuilder() {
  const phases = buildActivityPhasesFromTrace({
    turn: {
      id: "t",
      status: "FAILED",
      startedAt: new Date(),
      finishedAt: new Date(),
      errorCode: "LLM_FAILED",
    },
    toolRuns: [],
  });
  assert.equal(phases.at(-1).phase, "failed");
  assert.equal(phases.at(-1).errorCode, "LLM_FAILED");
  console.log("ok  activity phase synthesis");
}

function testWiring() {
  const ownerList = read("app/api/agents/[id]/traces/route.js");
  const ownerOne = read("app/api/agents/[id]/traces/[turnRunId]/route.js");
  const adminOne = read("app/api/admin/traces/[turnRunId]/route.js");
  assert.match(ownerList, /listAgentTurnTracesForOwner/);
  assert.match(ownerOne, /getAgentTurnTraceForOwner/);
  assert.match(adminOne, /requireAdmin/);
  assert.match(adminOne, /getAgentTurnTraceForAdmin/);

  const svc = read("lib/services/agent-trace.service.js");
  assert.match(svc, /assembleAgentTurnTrace/);
  assert.doesNotMatch(svc, /resultForModel/);
  assert.doesNotMatch(svc, /bodyText/);

  const api = read("lib/api/traces.js");
  assert.match(api, /listAgentTraces/);
  assert.match(api, /getAgentTrace/);

  const ui = read("components/studio/StudioAgentTraces.jsx");
  assert.match(ui, /listAgentTraces/);
  assert.match(ui, /getAgentTrace/);
  assert.match(ui, /provider bodies excluded|No provider bodies/i);
  assert.doesNotMatch(ui, /bodyText|resultForModel|plaintext/);

  const studio = read("components/studio/AgentTestStudio.jsx");
  assert.match(studio, /StudioAgentTraces/);
  assert.match(studio, /id:\s*"traces"/);
  console.log("ok  owner + admin trace routes wired");
}

function main() {
  testPreviewAndSafety();
  testAssembleWithoutProviderBodies();
  testActivityBuilder();
  testWiring();
  console.log("\nagent-trace smoke passed");
}

main();
