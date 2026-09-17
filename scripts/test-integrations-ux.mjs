/**
 * Universal Integrations UX — connection probe + OpenAPI UI + MCP tab wiring.
 * Run: npm run test:integrations-ux
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildConnectionProbeUrl,
  connectionVerificationLabel,
  connectionVerificationStatus,
  isProbeHttpSuccess,
} from "../lib/integrations/connection-probe.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function testProbeHelpers() {
  assert.equal(
    buildConnectionProbeUrl("https://api.example.com"),
    "https://api.example.com/"
  );
  assert.equal(
    buildConnectionProbeUrl("https://api.example.com/", "/health"),
    "https://api.example.com/health"
  );
  assert.equal(isProbeHttpSuccess(200), true);
  assert.equal(isProbeHttpSuccess(404), true);
  assert.equal(isProbeHttpSuccess(500), false);
  assert.equal(isProbeHttpSuccess(null), false);
  assert.equal(
    connectionVerificationStatus({ healthVerifiedAt: new Date() }),
    "verified"
  );
  assert.equal(connectionVerificationStatus({}), "unverified");
  assert.equal(connectionVerificationLabel("verified"), "Verified");
  console.log("ok  connection probe helpers");
}

function testWiring() {
  const svc = read("lib/services/connection.service.js");
  assert.match(svc, /probeConnectionForAgent/);
  assert.match(svc, /healthVerifiedAt/);
  assert.match(svc, /liveConnected/);
  assert.doesNotMatch(svc, /bodyText:/);

  const route = read(
    "app/api/agents/[id]/connections/[connectionId]/probe/route.js"
  );
  assert.match(route, /probeConnectionForAgent/);

  const wizard = read("components/customization/ConnectionWizard.jsx");
  assert.match(wizard, /probeAgentConnection/);
  assert.match(wizard, /Test connection/);
  assert.match(wizard, /Verified|Not verified/);

  const openapi = read("components/customization/OpenApiImportPanel.jsx");
  assert.match(openapi, /importAgentOpenApiActions/);
  assert.match(openapi, /Import disabled drafts/);
  assert.match(openapi, /dryRun/);

  const actions = read("components/customization/ActionsForm.jsx");
  assert.match(actions, /OpenApiImportPanel/);
  assert.match(actions, /McpServersPanel/);
  assert.doesNotMatch(actions, /MCP servers will land here/);

  const api = read("lib/api/connections.js");
  assert.match(api, /probeAgentConnection/);
  console.log("ok  integrations UX wiring");
}

testProbeHelpers();
testWiring();
console.log("integrations-ux: ok");
