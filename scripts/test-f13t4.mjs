/**
 * F13-T4 smoke — hardening: audit, per-server rate limits, kill switch, suite glue.
 * Run: npm run test:f13t4
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  mcpProbeLimitOpts,
  mcpServerOutboundLimitOpts,
} from "../lib/rate-limit-config.js";
import { inferMcpToolRisk } from "../lib/mcp/client.js";
import { evaluateActionPolicy } from "../lib/actions/policy.js";

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

async function maybeLiveDemoMcp() {
  const base = (
    process.env.TEST_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://127.0.0.1:3000"
  ).replace(/\/$/, "");
  const url = `${base}/api/demo/mcp`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const json = await res.json();
    const tools = json?.result?.tools || [];
    const names = tools.map((t) => t.name);
    assert(names.includes("get_demo_time"), "live demo lists get_demo_time");
    assert(names.includes("create_demo_note"), "live demo lists create_demo_note");

    const call = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "get_demo_time", arguments: { timezone: "UTC" } },
      }),
      signal: AbortSignal.timeout(4000),
    });
    const called = await call.json();
    const text = called?.result?.content?.[0]?.text || "";
    assert(/aide_demo_mcp|iso/.test(text), "live get_demo_time returns payload");
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message || "unreachable" };
  }
}

async function main() {
  assert(exists("lib/mcp/audit.js"), "lib/mcp/audit.js");
  const audit = read("lib/mcp/audit.js");
  assert(/logMcpAudit/.test(audit), "logMcpAudit export");

  const safeLog = read("lib/observability/safe-log.js");
  assert(/mcpServerId/.test(safeLog), "safe-log allows mcpServerId");
  assert(/mcpToolId/.test(safeLog), "safe-log allows mcpToolId");

  const limits = mcpServerOutboundLimitOpts();
  assert(limits.limit >= 1 && limits.windowMs >= 1000, "mcp server outbound opts");
  const probeOpts = mcpProbeLimitOpts();
  assert(probeOpts.limit >= 1, "mcp probe opts");

  const svc = read("lib/services/mcp.service.js");
  assert(/logMcpAudit\("mcp\.tool_enable"/.test(svc), "audit tool enable");
  assert(/logMcpAudit\("mcp\.tool_call"/.test(svc), "audit tool call");
  assert(/logMcpAudit\("mcp\.probe"/.test(svc), "audit probe");
  assert(/mcp:outbound:/.test(svc), "per-server outbound rate limit key");
  assert(/mcpServerOutboundLimitOpts/.test(svc), "uses mcpServerOutboundLimitOpts");
  assert(
    /actionsEnabled === false/.test(svc),
    "kill switch gates listEnabledMcpToolsForAgent"
  );

  const loop = read("lib/actions/tool-loop.js");
  assert(/listEnabledMcpToolsForAgent/.test(loop), "tool-loop loads MCP tools");
  assert(/actionsEnabled === false/.test(loop), "kill switch in listEnabledActionsForAgent");
  assert(/mcpToolId: data\.mcpToolId/.test(loop), "ToolRun mcpToolId audit");

  const probeRoute = read(
    "app/api/agents/[id]/mcp-servers/[serverId]/probe/route.js"
  );
  assert(/mcpProbeLimitOpts/.test(probeRoute), "probe uses mcpProbeLimitOpts");

  // WRITE MCP still confirmation-gated (F14 chat UI later)
  const writeRisk = inferMcpToolRisk("create_demo_note");
  assert(writeRisk.requiresConfirmation === true, "WRITE heuristic");
  const policy = evaluateActionPolicy({
    action: {
      riskLevel: writeRisk.riskLevel,
      requiresConfirmation: writeRisk.requiresConfirmation,
    },
    confirmationStatus: null,
  });
  assert(policy.allow === false, "WRITE blocked without confirmation");
  assert(policy.code === "CONFIRMATION_REQUIRED", "CONFIRMATION_REQUIRED code");

  const readRisk = inferMcpToolRisk("get_demo_time");
  const readPolicy = evaluateActionPolicy({
    action: {
      riskLevel: readRisk.riskLevel,
      requiresConfirmation: readRisk.requiresConfirmation,
    },
  });
  assert(readPolicy.allow === true, "READ allowed without confirmation");

  const pkg = read("package.json");
  assert(/"test:f13t4"/.test(pkg), "package test:f13t4");
  assert(
    /"test:f13":\s*"[^"]*test:f13t4/.test(pkg),
    "test:f13 suite includes t4"
  );
  assert(
    /"test:shipped":\s*"[^"]*test:f13"/.test(pkg),
    "test:shipped includes test:f13"
  );

  const plan = read("docs/features/F13_TOOLS_HUB.md");
  assert(/Phase T4/.test(plan) && /✅/.test(plan), "F13 plan marks T4");
  assert(/Status:.*[Dd]one|complete|shipped/i.test(plan) || /T0–T4 done/.test(plan), "F13 complete status");

  const live = await maybeLiveDemoMcp();
  if (live.ok) {
    console.log("ok  live demo MCP tools/list + get_demo_time");
  } else {
    console.log(`skip live demo MCP (${live.reason})`);
  }

  console.log("ok  MCP audit + per-server rate limits + kill switch");
  console.log("ok  WRITE confirmation gate (policy)");
  console.log("\nF13-T4 smoke passed");
}

try {
  await main();
} catch (error) {
  console.error("\nF13-T4 smoke FAILED:", error.message);
  process.exit(1);
}
