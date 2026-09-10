import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const agentList = read("components/agents/AgentList.jsx");
const workspace = read("components/layout/WorkspaceSwitcher.jsx");
const dashboard = read("app/(app)/dashboard/page.jsx");
const analytics = read("components/analytics/analytics-shared.jsx");
const plans = read("components/billing/BillingPlanPicker.jsx");
const keys = read("lib/query/keys.js");

assert.match(agentList, /useQuery/);
assert.match(agentList, /queryKeys\.agents\.all/);
assert.match(agentList, /setQueryData/);
assert.match(workspace, /useQuery/);
assert.match(workspace, /queryKeys\.workspaces\.list/);
assert.match(dashboard, /queryKeys\.analytics\.overview/);
assert.match(dashboard, /queryKeys\.conversations\.list/);
assert.match(dashboard, /queryKeys\.agents\.all/);
assert.match(analytics, /useQuery/);
assert.match(analytics, /queryKeys\.analytics\.dashboard/);
assert.match(analytics, /placeholderData/);
assert.match(plans, /useQuery/);
assert.match(plans, /queryKeys\.billing\.plans/);
assert.match(keys, /workspaces:/);
assert.match(keys, /analytics:/);
assert.match(keys, /conversations:/);

console.log("TanStack Query Q2 agents/workspaces/dashboard contracts passed");
