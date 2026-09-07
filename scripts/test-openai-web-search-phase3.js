import assert from "node:assert/strict";
import fs from "node:fs";

const loop = fs.readFileSync(new URL("../lib/orchestrator/loop.js", import.meta.url), "utf8");
const chat = fs.readFileSync(new URL("../lib/services/chat.service.js", import.meta.url), "utf8");
const api = fs.readFileSync(new URL("../lib/api/chat.js", import.meta.url), "utf8");
const list = fs.readFileSync(new URL("../components/chat/MessageList.jsx", import.meta.url), "utf8");
const bubble = fs.readFileSync(new URL("../components/chat/AgentActivityBubble.jsx", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../components/chat/ChatWorkspace.jsx", import.meta.url), "utf8");
const publicRoute = fs.readFileSync(new URL("../app/api/public/agents/[publicKey]/chat/route.js", import.meta.url), "utf8");
const publicChat = fs.readFileSync(new URL("../components/embed/PublicWebchat.jsx", import.meta.url), "utf8");

assert.match(loop, /kind: "agent_activity"/);
assert.match(loop, /normalizedStatus === "selected"/);
assert.match(loop, /normalizedStatus === "running"/);
assert.match(loop, /route: route \|\| "GENERAL"/);
assert.match(loop, /safeToolName = name === "web_search"/);
assert.doesNotMatch(loop, /argsRaw.*agent_activity/);
assert.doesNotMatch(loop, /resultForModel.*agent_activity/);
assert.match(loop, /needs_confirmation/);
assert.match(chat, /activityId: "knowledge-selection"/);
assert.match(chat, /mode: "knowledge"/);
assert.match(api, /onTool/);
assert.match(api, /type === "tool"/);
assert.match(api, /sendPublicChatMessageStream/);
assert.match(publicRoute, /text\/event-stream/);
assert.match(publicRoute, /publicAccess: true/);
assert.match(publicChat, /sendPublicChatMessageStream/);
assert.match(publicChat, /streamingId/);
assert.match(list, /AgentActivityBubble/);
assert.match(workspace, /activeActivities/);
assert.match(workspace, /onTool:/);
assert.match(bubble, /role="status"/);
assert.match(bubble, /prefers-reduced-motion|animate-spin/);

console.log("OpenAI hosted web-search Phase 3 activity contract passed");
