/**
 * B7 — agent setup advice in the embed checklist (warn/pass only, never blocks "ready").
 * Run: npm run test:agent-setup-checks
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateAgentSetup, evaluateEmbedReadiness } from "../lib/embed/readiness.js";

const ids = (part) => part.items.filter((item) => item.state === "warn").map((item) => item.id);

test("the AIDE Support Assistant setup gets every warning it deserves", () => {
  const part = evaluateAgentSetup({
    knowledgeDocs: 0,
    promptChars: 3535,
    embedEnabled: true,
    mcpServers: [{ name: "GitHub MCP", enabledTools: 45, writeToolNames: ["merge_pull_request", "push_files", "delete_file", "create_repository"] }],
  });
  assert.equal(part.id, "setup");
  assert.equal(part.state, "warn");
  assert.deepEqual(ids(part), ["setup_knowledge", "setup_mcp_many_0", "setup_mcp_writes_0"]);
  const writes = part.items.find((item) => item.id === "setup_mcp_writes_0");
  assert.match(writes.title, /4 tools can change data/);
  assert.match(writes.reason, /merge_pull_request, push_files, delete_file and 1 more\. Each/);
});

test("a healthy agent passes; edges around the limits", () => {
  const healthy = evaluateAgentSetup({ knowledgeDocs: 3, promptChars: 900, embedEnabled: true, mcpServers: [{ name: "Docs MCP", enabledTools: 12, writeToolNames: [] }] });
  assert.equal(healthy.state, "pass");
  assert.deepEqual(ids(healthy), []);
  assert.equal(ids(evaluateAgentSetup({ knowledgeDocs: 1, promptChars: 3599 })).length, 0);
  assert.deepEqual(ids(evaluateAgentSetup({ knowledgeDocs: 1, promptChars: 3600 })), ["setup_prompt"]);
  assert.deepEqual(ids(evaluateAgentSetup({ knowledgeDocs: 1, mcpServers: [{ enabledTools: 13 }] })), ["setup_mcp_many_0"]);
  // Write tools on an agent that is not embedded are not a visitor risk.
  assert.deepEqual(ids(evaluateAgentSetup({ knowledgeDocs: 1, embedEnabled: false, mcpServers: [{ enabledTools: 3, writeToolNames: ["delete_file"] }] })), []);
  // Missing / junk input never throws and never fails.
  const empty = evaluateAgentSetup();
  assert.ok(empty.items.every((item) => item.state === "warn" || item.state === "pass"));
  assert.doesNotThrow(() => evaluateAgentSetup({ mcpServers: [null, { name: 5 }] }));
});

test("setup advice never changes readiness, the fail alert, or the 3-part layout without it", () => {
  const base = {
    liveOrigin: "https://shop.example",
    lastPingAt: new Date().toISOString(),
    setUserSeen: false,
    embedConversations: 0,
    needsSetUser: false,
    unsafeAccountTools: 0,
    actionsEnabled: false,
    integrations: [],
  };
  const without = evaluateEmbedReadiness(base);
  assert.equal(without.parts.length, 3, "callers without setup data keep today's parts");
  const withSetup = evaluateEmbedReadiness({ ...base, setup: { knowledgeDocs: 0, promptChars: 3900, embedEnabled: true, mcpServers: [{ enabledTools: 45, writeToolNames: ["delete_file"] }] } });
  assert.equal(withSetup.parts.length, 4);
  assert.equal(withSetup.parts[3].id, "setup");
  assert.equal(withSetup.ready, without.ready, "ready is unchanged by setup warnings");
  assert.ok(!withSetup.parts.some((part) => part.id === "setup" && part.state === "fail"));
  assert.deepEqual(withSetup.checks.map((c) => c.id), without.checks.map((c) => c.id), "checks list unchanged");
});
