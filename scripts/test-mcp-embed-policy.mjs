/**
 * AIDE-GAP-010 / AIDE-SEC-001 — PEP is authoritative for MCP embed auto-run.
 */
import assert from "node:assert/strict";
import {
  evaluateActionPolicy,
  isServerProvenPublicMcpRead,
} from "../lib/actions/policy.js";
import { mcpToolToActionShape } from "../lib/services/mcp.service.js";

function mcpAction(overrides = {}) {
  return {
    name: "list_help_articles",
    riskLevel: "READ",
    requiresConfirmation: false,
    accessClass: "",
    _mcp: { toolId: "t1", serverId: "s1" },
    ...overrides,
  };
}

{
  const p = evaluateActionPolicy({
    action: mcpAction({ accessClass: "PUBLIC_READ" }),
    publicAccess: true,
  });
  assert.equal(p.allow, true);
  assert.equal(p.needsConfirmation, false);
  assert.equal(isServerProvenPublicMcpRead(mcpAction({ accessClass: "PUBLIC_READ" })), true);
}

{
  const p = evaluateActionPolicy({
    action: mcpAction({ accessClass: "GUEST_LOOKUP", name: "list_public_hours" }),
    publicAccess: true,
  });
  assert.equal(p.allow, true);
}

{
  const p = evaluateActionPolicy({
    action: mcpAction({ accessClass: "ACCOUNT_READ", name: "get_profile" }),
    publicAccess: true,
  });
  assert.equal(p.allow, false);
  assert.ok(
    ["CONFIRMATION_REQUIRED", "IDENTITY_REQUIRED", "IDENTITY_PROOF_REQUIRED"].includes(p.code)
  );
}

{
  const p = evaluateActionPolicy({
    action: mcpAction({ accessClass: "", name: "get_me" }),
    publicAccess: true,
  });
  assert.equal(p.allow, false);
  assert.equal(p.code, "CONFIRMATION_REQUIRED");
  assert.equal(isServerProvenPublicMcpRead(mcpAction({ name: "get_me", accessClass: "PUBLIC_READ" })), false);
}

{
  const p = evaluateActionPolicy({
    action: mcpAction({ riskLevel: "WRITE", name: "create_issue", accessClass: "PUBLIC_READ" }),
    publicAccess: true,
  });
  assert.equal(p.allow, false);
  assert.equal(p.code, "CONFIRMATION_REQUIRED");
}

{
  const p = evaluateActionPolicy({
    action: mcpAction({ riskLevel: "DESTRUCTIVE", name: "delete_repo" }),
    publicAccess: true,
  });
  assert.equal(p.allow, false);
  assert.equal(p.code, "CONFIRMATION_REQUIRED");
}

{
  const shape = mcpToolToActionShape(
    {
      id: "tool1",
      name: "get_me",
      functionName: "get_me",
      description: "READ my github user",
      riskLevel: "READ",
      requiresConfirmation: false,
      enabled: true,
      inputSchemaJson: {},
      server: {
        id: "s1",
        agentId: "a1",
        url: "https://example.com/mcp",
        enabled: true,
        frozenHost: "example.com",
        authType: "NONE",
      },
    },
    "ws1"
  );
  assert.equal(shape.accessClass, "");
  assert.equal(shape._mcp.toolId, "tool1");
  const p = evaluateActionPolicy({ action: shape, publicAccess: true });
  assert.equal(p.allow, false);
  assert.equal(p.code, "CONFIRMATION_REQUIRED");
}

console.log("ok  MCP embed PEP accessClass");
