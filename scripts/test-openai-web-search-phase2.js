import assert from "node:assert/strict";
import fs from "node:fs";

const provider = fs.readFileSync(new URL("../lib/services/ai/llm.provider.js", import.meta.url), "utf8");
const loop = fs.readFileSync(new URL("../lib/orchestrator/loop.js", import.meta.url), "utf8");
const chatApi = fs.readFileSync(new URL("../lib/api/chat.js", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../components/chat/ChatWorkspace.jsx", import.meta.url), "utf8");
const activity = fs.readFileSync(new URL("../components/chat/AgentActivityBubble.jsx", import.meta.url), "utf8");
const plan = fs.readFileSync(new URL("../docs/features/OPENAI_WEB_SEARCH_MIGRATION_PLAN.md", import.meta.url), "utf8");

assert.match(provider, /client\.responses\.create/);
assert.match(provider, /responsesStreamTurn/);
assert.match(provider, /parseWebSearchEvent/);
assert.match(provider, /type: "web_search"/);
assert.match(provider, /tool_choice: "required"/);
assert.match(provider, /web_search_call\.action\.sources/);
assert.match(loop, /sourceDecision\.route === "WEB"/);
assert.match(loop, /responsesTurn/);
assert.match(loop, /responsesStreamTurn/);
assert.match(loop, /sourceDecision\.route === "MIXED"/);
assert.match(loop, /STORE PREFLIGHT ONLY/);
assert.match(loop, /<store_data>/);
assert.match(chatApi, /text\/event-stream/);
assert.match(workspace, /sendChatMessageStream/);
assert.match(workspace, /activeActivities/);
assert.match(activity, /Searching the web/);
assert.match(activity, /role="status"/);
assert.match(plan, /two-phase execution/);

async function main() {
  const { buildResponsesWebSearchPayload } = await import("../lib/services/ai/llm.provider.js");
  const payload = buildResponsesWebSearchPayload({
    system: "Use online sources.",
    messages: [{ role: "user", content: "Search online for today's headlines" }],
  });
  assert.equal(payload.model, process.env.OPENAI_WEB_SEARCH_MODEL || "gpt-4.1-mini");
  assert.deepEqual(payload.tools, [{ type: "web_search", search_context_size: "medium" }]);
  assert.equal(payload.tool_choice, "required");
  assert.deepEqual(payload.include, ["web_search_call.action.sources"]);
  assert.equal(payload.input[0].role, "user");
  console.log("OpenAI hosted web-search Phase 2 provider contract passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
