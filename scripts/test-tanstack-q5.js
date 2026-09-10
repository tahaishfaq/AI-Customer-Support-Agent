import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const client = read("lib/query/client.js");
const boundary = read("components/query/QueryErrorBoundary.jsx");
const provider = read("components/providers.jsx");
const agentCard = read("components/agents/AgentCard.jsx");
const embed = read("components/embed/PublicWebchat.jsx");

assert.match(client, /MutationCache/);
assert.match(client, /toast\.error/);
assert.match(boundary, /getDerivedStateFromError/);
assert.match(provider, /isPublicEmbed/);
assert.match(provider, /isPublicEmbed \? \(/);
assert.match(agentCard, /prefetchQuery/);
assert.match(agentCard, /queryKeys\.agents\.detail/);
assert.doesNotMatch(embed, /@tanstack\/react-query/);

console.log("TanStack Query Q5 hardening contracts passed");
