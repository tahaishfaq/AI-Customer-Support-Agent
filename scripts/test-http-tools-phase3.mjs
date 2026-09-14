import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isActionDestinationAllowed,
  normalizeOrigin,
} from "../lib/actions/connection-policy.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (relativePath) => readFile(path.join(root, relativePath), "utf8");

assert.equal(normalizeOrigin("https://api.example.com/"), "https://api.example.com");
assert.equal(normalizeOrigin("http://127.0.0.1:3100/"), "http://127.0.0.1:3100");
assert.throws(() => normalizeOrigin("https://api.example.com/v1"));
assert.throws(() => normalizeOrigin("http://api.example.com/"));

const revision = {
  baseOrigin: "https://api.example.com",
  allowedDestinations: ["https://api.example.com", "https://status.example.com"],
};
assert.equal(
  isActionDestinationAllowed("https://api.example.com/orders/{{id}}", revision),
  true
);
assert.equal(
  isActionDestinationAllowed("https://evil.example.com/orders/{{id}}", revision),
  false
);

const schema = await source("prisma/schema.prisma");
assert.match(schema, /model IntegrationConnection \{/);
assert.match(schema, /model IntegrationConnectionRevision \{/);
assert.match(schema, /connectionId\s+String\?/);
assert.match(schema, /connectionRevisions IntegrationConnectionRevision\[\]/);

const service = await source("lib/services/connection.service.js");
assert.match(service, /workspaceId: agent\.workspaceId/);
assert.match(service, /CONNECTION_DESTINATION_DENIED/);
assert.match(service, /revokedAt: null/);
const credentialApply = await source("lib/actions/credential-apply.js");
assert.match(credentialApply, /out\.Authorization = `Bearer \$\{plain\}`/);
assert.match(credentialApply, /preferEndUserAuth/);

for (const route of [
  "app/api/agents/[id]/connections/route.js",
  "app/api/agents/[id]/connections/[connectionId]/revisions/route.js",
]) {
  const routeSource = await source(route);
  assert.match(routeSource, /requireAuth/);
  assert.match(routeSource, /connection/);
}

const actionService = await source("lib/services/action.service.js");
assert.match(actionService, /resolveActionConnection/);
assert.match(actionService, /connectionId/);
const invoke = await source("lib/actions/invoke-tool.js");
assert.match(invoke, /resolveActionConnection/);
assert.match(invoke, /runtimeCredentialId/);

console.log("HTTP tools Phase 3 connection and credential lifecycle checks passed");
