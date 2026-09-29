/**
 * B4 end-to-end through the real orchestrator loop, with a local mock of the chat-completions API
 * (OPENAI_BASE_URL). The mock rejects any request where a tool call has no tool reply, like the
 * real API. No network, no database writes (DATABASE_URL points at a closed port; audits fail closed).
 *
 * Run: npm run test:handoff-deferral-loop
 */
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";

let server;
let queue = [];
const requests = [];

function completion(message) {
  return {
    id: `cmpl_${requests.length}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: "mock",
    choices: [{ index: 0, message: { role: "assistant", content: null, ...message }, finish_reason: message.tool_calls ? "tool_calls" : "stop" }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
}
const toolCall = (id, name, args = {}) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });

/** Every assistant tool call must be answered by a tool message before the next non-tool message. */
function unansweredToolCalls(messages) {
  const open = new Set();
  for (const message of messages) {
    if (message.role === "assistant" && Array.isArray(message.tool_calls)) {
      if (open.size) return [...open];
      for (const call of message.tool_calls) open.add(call.id);
    } else if (message.role === "tool") {
      open.delete(message.tool_call_id);
    } else if (open.size) {
      return [...open];
    }
  }
  return [...open];
}

before(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const body = JSON.parse(raw || "{}");
      requests.push(body);
      const missing = unansweredToolCalls(body.messages || []);
      if (missing.length) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { message: `tool_call_ids without response: ${missing.join(",")}` } }));
        return;
      }
      const next = queue.shift() || { content: "fallback" };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(completion(next)));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_BASE_URL = `http://127.0.0.1:${server.address().port}/v1`;
  process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/test";
  process.env.PG_POOL_CONNECT_MS = "300";
});

after(() => server?.close());

async function runLoop({ lastUserMessage, script, history = [] }) {
  const { runOrchestratorLoop } = await import("../lib/orchestrator/loop.js");
  const { listBuiltinActionsForAgent } = await import("../lib/capabilities/builtins.js");
  queue = [...script];
  requests.length = 0;
  const actions = listBuiltinActionsForAgent("agent_test", { includeWebSearch: false });
  return runOrchestratorLoop({
    system: "You are a support agent.",
    messages: [...history, { role: "user", content: lastUserMessage }],
    actions,
    agentId: "agent_test",
    conversationId: null,
    lastUserMessage,
    publicAccess: true,
    streaming: false,
  });
}

const R48 = "What plans do you offer, how do I reset my password, and what is the weather in Karachi today?";

test("R48: handoff batched with another tool is deferred; the model answers; team is offered", async () => {
  const result = await runLoop({
    lastUserMessage: R48,
    script: [
      { tool_calls: [toolCall("call_meta", "get_conversation_meta"), toolCall("call_handoff", "request_handoff", { reason: "weather" })] },
      { content: "Our plans are Starter and Pro. To reset your password use Forgot password. I can't check live weather." },
    ],
  });
  assert.equal(result.humanOffered, true);
  assert.equal(result.stopReason, "final");
  assert.match(result.assistantText, /Starter and Pro/);
  assert.ok(!result.toolSteps.some((step) => step.name === "request_handoff"), "handoff never dispatched");
  // The second model call saw a "deferred" reply for the handoff call and no unanswered call.
  const second = requests[1];
  const deferred = second.messages.find((m) => m.role === "tool" && m.tool_call_id === "call_handoff");
  assert.match(deferred.content, /"status":"deferred"/);
  assert.deepEqual(unansweredToolCalls(second.messages), []);
});

test("explicit human ask: the same batch dispatches the handoff (not deferred)", async () => {
  const result = await runLoop({
    lastUserMessage: "Please connect me with a person from your team",
    script: [
      { tool_calls: [toolCall("call_meta", "get_conversation_meta"), toolCall("call_handoff", "request_handoff", { reason: "asked" })] },
      { content: "Connecting you." },
    ],
  });
  assert.ok(result.toolSteps.some((step) => step.name === "request_handoff"), "handoff was dispatched");
  assert.equal(result.humanOffered, undefined);
});

test("handoff on its own (customer did not ask): deferred, the reply offers the team", async () => {
  const result = await runLoop({
    lastUserMessage: "where is my order 88231?",
    script: [
      { tool_calls: [toolCall("call_handoff", "request_handoff", { reason: "order lookup" })] },
      { content: "I can't look up orders here. Would you like me to connect you with our support team?" },
    ],
  });
  assert.equal(result.humanOffered, true);
  assert.ok(!result.toolSteps.some((step) => step.name === "request_handoff"), "not dispatched");
  assert.match(result.assistantText, /connect you with our support team/);
  assert.deepEqual(unansweredToolCalls(requests[1].messages), []);
});

test("model insists on an unasked handoff: loop stops, final reply offers the team, never dispatched", async () => {
  const result = await runLoop({
    lastUserMessage: "mera order 88231 kab aayega?",
    script: [
      { tool_calls: [toolCall("call_h1", "request_handoff", { reason: "order" })] },
      { tool_calls: [toolCall("call_h2", "request_handoff", { reason: "order" })] },
      { content: "Maaf kijiye, main yahan order status nahi dekh sakta. Kya aap team se baat karna chahenge?" },
      { tool_calls: [toolCall("call_h3", "request_handoff", { reason: "should never be requested" })] },
    ],
  });
  assert.equal(result.stopReason, "offer_team");
  assert.equal(result.humanOffered, true);
  assert.ok(!result.toolSteps.some((step) => step.name === "request_handoff"), "never dispatched");
  assert.match(result.assistantText, /team se baat/);
  assert.equal(requests.length, 3, "two tool rounds + one final text call, no endless loop");
  assert.match(requests[2].messages[0].content, /did not ask for a person/, "final call carries the offer note");
  assert.deepEqual(unansweredToolCalls(requests[2].messages), []);
});

test("customer says yes to the team offer: handoff dispatched", async () => {
  const result = await runLoop({
    history: [
      { role: "user", content: "where is my order 88231?" },
      { role: "assistant", content: "Would you like me to connect you with our support team?" },
    ],
    lastUserMessage: "yes please",
    script: [{ tool_calls: [toolCall("call_handoff", "request_handoff", { reason: "accepted offer" })] }, { content: "Connecting you." }],
  });
  assert.ok(result.toolSteps.some((step) => step.name === "request_handoff"));
  assert.equal(result.humanOffered, undefined);
});
