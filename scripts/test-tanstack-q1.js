import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const provider = read("components/providers.jsx");
const queryProvider = read("components/query/QueryProvider.jsx");
const client = read("lib/query/client.js");
const keys = read("lib/query/keys.js");
const quota = read("hooks/use-conversation-quota.js");
const waiting = read("hooks/use-desk-waiting-count.js");
const studio = read("hooks/use-agent-studio.js");
const packageJson = JSON.parse(read("package.json"));

assert.match(provider, /QueryProvider/);
assert.match(queryProvider, /QueryClientProvider/);
assert.match(queryProvider, /RealtimeQuerySync/);
assert.match(queryProvider, /BILLING_REFRESH_EVENT/);
assert.match(queryProvider, /invalidateIfStale/);
assert.match(queryProvider, /BILLING_SUBSCRIPTION_UPDATED/);
assert.match(queryProvider, /HANDOFF_CREATED/);
assert.match(client, /staleTime: 30_000/);
assert.match(client, /gcTime: 10 \* 60_000/);
assert.match(keys, /billing:/);
assert.match(keys, /desk:/);
assert.match(quota, /useQuery/);
assert.match(quota, /queryKeys\.billing\.status/);
assert.match(quota, /BILLING_FALLBACK_POLL_MS/);
assert.match(waiting, /useQuery/);
assert.match(waiting, /queryKeys\.desk\.waiting/);
assert.match(waiting, /DESK_NAV_BADGE_POLL_MS/);
assert.match(studio, /useQuery/);
assert.match(studio, /queryKeys\.agents\.detail/);
assert.doesNotMatch(studio, /new Map/);
assert.equal(typeof packageJson.dependencies["@tanstack/react-query"], "string");

console.log("TanStack Query Q1 billing/desk contracts passed");
