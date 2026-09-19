/**
 * Focused regressions: soft-fallback gate, MCP error detail, hostedWeb skip.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { selectKnowledgeChunks } from "../lib/services/ai/knowledge-retrieve.js";
import {
  formatToolResultForModel,
  safeToolErrorMessage,
} from "../lib/actions/tool-errors.js";
import { routeSource } from "../lib/services/ai/source-policy.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const noiseDoc = {
  id: "n",
  name: "Brandly Product Knowledge",
  type: "TEXT",
  content: "Unrelated cactus watering schedule for lobby plants.",
  createdAt: "2024-01-01T00:00:00.000Z",
};

{
  const soft = selectKnowledgeChunks({
    docs: [noiseDoc],
    query: "xyzzy qqzz",
    allowSoftFallback: true,
  });
  assert.ok(soft.text.length > 0 || soft.used.length > 0, "default soft packs");
}

{
  const blocked = selectKnowledgeChunks({
    docs: [noiseDoc],
    query: "list github repos with js code",
    allowSoftFallback: false,
  });
  assert.equal(blocked.text, "", "no soft text when disabled");
  assert.equal(blocked.used.length, 0, "no soft used when disabled");
}

{
  const gh = routeSource("search github repositories for next.js");
  assert.equal(gh.signals.wantsGithub, true, "wantsGithub");
  assert.equal(gh.preferAgentKnowledge, false, "preferAgentKnowledge off for github");
}

{
  const msg = safeToolErrorMessage({
    errorCode: "MCP_TOOL_ERROR",
    httpStatus: null,
    bodyText: "[MCP error] missing owner",
  });
  assert.match(msg, /MCP tool|invent/i, "MCP error message");
}

{
  const formatted = JSON.parse(
    formatToolResultForModel({
      ok: false,
      status: "ERROR",
      httpStatus: null,
      errorCode: "MCP_TOOL_ERROR",
      bodyText: "[MCP error] repository not found",
    })
  );
  assert.equal(formatted.errorCode, "MCP_TOOL_ERROR");
  assert.ok(formatted.detail, "MCP detail included");
  assert.match(String(formatted.replyHint || ""), /invent/i, "replyHint");
}

{
  const loop = read("lib/orchestrator/loop.js");
  assert.match(loop, /!wantsGithub/, "hostedWeb skips when wantsGithub");
  assert.match(loop, /!hasMcpOffered/, "hostedWeb skips when MCP offered");
  assert.match(loop, /GITHUB_INVENTORY_REFUSE|hasSuccessfulGithubInventory/, "fail-closed");
  assert.match(loop, /sourceDecisionIn|sourceDecision:/, "accepts sourceDecision");
}

{
  const turn = read("lib/services/ai/turn-context.js");
  assert.match(turn, /allowSoftFallback/, "wires soft-fallback flag");
  assert.match(turn, /preferAgentKnowledge/, "uses preferAgentKnowledge");
}

{
  const mcp = read("lib/services/mcp.service.js");
  assert.match(mcp, /httpStatus: isError \? null : 200/, "MCP error httpStatus null");
}

console.log("ok  mcp-knowledge-grounding focused regressions");
