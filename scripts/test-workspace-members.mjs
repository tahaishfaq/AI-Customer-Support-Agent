/**
 * Task 8 — Additive WorkspaceMember seats; owner path unchanged; member read scoped.
 * Run: npm run test:workspace-members
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveWorkspaceAccess,
  roleAllowsWorkspaceManage,
  roleAllowsWorkspaceRead,
  serializeWorkspaceAccessSummary,
} from "../lib/workspace-authz.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function testOwnerPathWithoutMembershipRow() {
  const workspace = { id: "ws_1", userId: "owner_1", name: "Acme", slug: "acme" };
  const access = resolveWorkspaceAccess({ workspace, userId: "owner_1" });
  assert.equal(access.via, "owner");
  assert.equal(access.role, "OWNER");
  assert.equal(access.canRead, true);
  assert.equal(access.canManage, true);
  assert.equal(access.allowed, true);

  const summary = serializeWorkspaceAccessSummary(
    { ...workspace, agentCount: 2 },
    access
  );
  assert.equal(summary.agentCount, 2);
  assert.equal(summary.membershipRole, undefined);
  console.log("ok  owner path without membership row");
}

function testMemberReadScoped() {
  const workspace = { id: "ws_1", userId: "owner_1", name: "Acme", slug: "acme" };
  const member = resolveWorkspaceAccess({
    workspace,
    userId: "member_1",
    membership: {
      workspaceId: "ws_1",
      userId: "member_1",
      role: "MEMBER",
    },
  });
  assert.equal(member.via, "member");
  assert.equal(member.canRead, true);
  assert.equal(member.canManage, false);
  assert.ok(roleAllowsWorkspaceRead("VIEWER"));
  assert.equal(roleAllowsWorkspaceManage("MEMBER"), false);
  assert.equal(roleAllowsWorkspaceManage("ADMIN"), true);

  const stranger = resolveWorkspaceAccess({
    workspace,
    userId: "stranger",
    membership: null,
  });
  assert.equal(stranger.canRead, false);
  assert.equal(stranger.allowed, false);

  const wrongSeat = resolveWorkspaceAccess({
    workspace,
    userId: "member_1",
    membership: {
      workspaceId: "ws_OTHER",
      userId: "member_1",
      role: "ADMIN",
    },
  });
  assert.equal(wrongSeat.canRead, false);

  const summary = serializeWorkspaceAccessSummary(
    { ...workspace, agentCount: 0 },
    member
  );
  assert.equal(summary.membershipRole, "MEMBER");
  console.log("ok  member read scoped; strangers denied");
}

function testOwnerWinsOverMembership() {
  const workspace = { id: "ws_1", userId: "owner_1" };
  const access = resolveWorkspaceAccess({
    workspace,
    userId: "owner_1",
    membership: {
      workspaceId: "ws_1",
      userId: "owner_1",
      role: "VIEWER",
    },
  });
  assert.equal(access.via, "owner");
  assert.equal(access.canManage, true);
  console.log("ok  owner record wins over membership role");
}

function testSchemaAndServiceWiring() {
  const schema = read("prisma/schema.prisma");
  assert.match(schema, /enum WorkspaceMemberRole/);
  assert.match(schema, /model WorkspaceMember/);
  assert.match(schema, /workspaceMemberships\s+WorkspaceMember\[\]/);

  const migration = read(
    "prisma/migrations/20260917010000_workspace_members/migration.sql"
  );
  assert.match(migration, /CREATE TABLE "WorkspaceMember"/);
  assert.match(migration, /WorkspaceMemberRole/);

  const authz = read("lib/workspace-authz.js");
  assert.match(authz, /resolveWorkspaceAccess/);
  assert.match(authz, /Workspace\.userId remains the owner/);

  const service = read("lib/services/workspace.service.js");
  assert.match(service, /ensureOwnerMembership/);
  assert.match(service, /listAccessibleWorkspaceEntries/);
  assert.match(service, /assertWorkspaceAccess/);
  assert.match(service, /access\.via !== "owner"/);
  assert.match(service, /serializeWorkspaceAccessSummary/);
  console.log("ok  schema + service wiring");
}

testOwnerPathWithoutMembershipRow();
testMemberReadScoped();
testOwnerWinsOverMembership();
testSchemaAndServiceWiring();
console.log("workspace-members: ok");
