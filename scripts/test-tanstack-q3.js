import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const inbox = read("components/desk/InboxShell.jsx");
const thread = read("components/desk/DeskThread.jsx");
const provider = read("components/query/QueryProvider.jsx");
const keys = read("lib/query/keys.js");
const invalidation = read("lib/query/invalidation.js");
const knowledge = read("components/knowledge/KnowledgeList.jsx");
const actions = read("components/customization/ActionsForm.jsx");
const mcp = read("components/customization/McpServersPanel.jsx");
const adminUsers = read("components/admin/AdminUsersDirectory.jsx");
const adminRequests = read("components/admin/AdminRestoreRequests.jsx");

assert.match(inbox, /useQuery/);
assert.match(inbox, /queryKeys\.desk\.inbox/);
assert.match(inbox, /queryKeys\.desk\.stats/);
assert.match(inbox, /refetchInterval/);
assert.match(thread, /useQuery/);
assert.match(thread, /queryKeys\.desk\.thread/);
assert.match(provider, /invalidateDeskQueries/);
assert.match(keys, /thread:/);
assert.match(invalidation, /queryKeys\.desk\.thread/);
assert.match(knowledge, /queryKeys\.knowledge\.list/);
assert.match(knowledge, /refetchInterval/);
assert.match(actions, /queryKeys\.actions\.list/);
assert.match(actions, /useQuery/);
assert.match(mcp, /queryKeys\.mcp\.list/);
assert.match(mcp, /useQuery/);
assert.match(adminUsers, /queryKeys\.admin\.users/);
assert.match(adminRequests, /queryKeys\.admin\.restoreRequests/);

console.log("TanStack Query Q3 desk list/thread contracts passed");
