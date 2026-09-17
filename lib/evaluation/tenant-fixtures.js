/** Sanitized multi-tenant fixtures for local authorization-contract tests. */
export const TENANT_FIXTURES = Object.freeze([
  { agentId: "a1", workspaceId: "w1", ownerId: "u1", customerId: "c1", pack: "ECOMMERCE", publicKey: "pk-a1" },
  { agentId: "a2", workspaceId: "w1", ownerId: "u1", customerId: "c2", pack: "ECOMMERCE", publicKey: "pk-a2" },
  { agentId: "a3", workspaceId: "w1", ownerId: "u2", customerId: "c3", pack: "SAAS", publicKey: "pk-a3" },
  { agentId: "a4", workspaceId: "w2", ownerId: "u1", customerId: "c4", pack: "SAAS", publicKey: "pk-a4" },
  { agentId: "a5", workspaceId: "w2", ownerId: "u3", customerId: "c5", pack: "SAAS", publicKey: "pk-a5" },
  { agentId: "a6", workspaceId: "w3", ownerId: "u4", customerId: "c6", pack: "LOGISTICS", publicKey: "pk-a6" },
  { agentId: "a7", workspaceId: "w3", ownerId: "u4", customerId: "c7", pack: "APPOINTMENTS", publicKey: "pk-a7" },
  { agentId: "a8", workspaceId: "w3", ownerId: "u5", customerId: "c8", pack: "ECOMMERCE", publicKey: "pk-a8" },
  { agentId: "a9", workspaceId: "w4", ownerId: "u6", customerId: "c9", pack: "SAAS", publicKey: "pk-a9" },
  { agentId: "a10", workspaceId: "w4", ownerId: "u7", customerId: "c10", pack: "ECOMMERCE", publicKey: "pk-a10" },
]);
