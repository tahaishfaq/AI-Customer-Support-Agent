/**
 * Level 2 · M3 — team desk permissions, least-busy routing, SLA, settings.
 * Run: npm run test:desk-routing
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_DESK_SETTINGS,
  deskAccessDenial,
  deskPermissions,
  isAssignableRole,
  pickLeastBusy,
  resolveDeskSettings,
  slaState,
} from "../lib/desk/routing.js";
import { resolveWorkspaceAccess } from "../lib/workspace-authz.js";

const workspace = { id: "ws1", userId: "owner" };
const member = (userId, role, workspaceId = "ws1") => ({ workspaceId, userId, role });
const permsFor = (userId, membership) => deskPermissions(resolveWorkspaceAccess({ workspace, userId, membership }));

test("role matrix: Viewer reads; Member replies; Owner/Admin manage; strangers nothing", () => {
  assert.deepEqual(permsFor("owner", null), { canRead: true, canReply: true, canManage: true });
  assert.deepEqual(permsFor("a", member("a", "ADMIN")), { canRead: true, canReply: true, canManage: true });
  assert.deepEqual(permsFor("m", member("m", "MEMBER")), { canRead: true, canReply: true, canManage: false });
  assert.deepEqual(permsFor("v", member("v", "VIEWER")), { canRead: true, canReply: false, canManage: false });
  assert.deepEqual(permsFor("x", null), { canRead: false, canReply: false, canManage: false });
  // A membership row for another workspace, or for another user, grants nothing here.
  assert.deepEqual(permsFor("m", member("m", "ADMIN", "ws2")), { canRead: false, canReply: false, canManage: false });
  assert.deepEqual(permsFor("m", member("someone-else", "ADMIN")), { canRead: false, canReply: false, canManage: false });
  assert.equal(isAssignableRole("MEMBER"), true);
  assert.equal(isAssignableRole("viewer"), false);
  assert.equal(isAssignableRole(null), false);
});

test("desk guard: owner unchanged; teammates only on handed-off chats, by need", () => {
  const handoffAt = new Date();
  const viewer = { canRead: true, canReply: false, canManage: false };
  const memberPerms = { canRead: true, canReply: true, canManage: false };
  const admin = { canRead: true, canReply: true, canManage: true };
  const none = { canRead: false, canReply: false, canManage: false };
  // Owner: full access even on chats never handed off (studio), as before.
  assert.equal(deskAccessDenial({ isOwner: true, perms: none, handoffAt: null, need: "manage" }), null);
  assert.equal(deskAccessDenial({ isOwner: false, perms: viewer, handoffAt, need: "read" }), null);
  assert.equal(deskAccessDenial({ isOwner: false, perms: viewer, handoffAt, need: "reply" }).status, 403);
  assert.equal(deskAccessDenial({ isOwner: false, perms: memberPerms, handoffAt, need: "reply" }), null);
  assert.equal(deskAccessDenial({ isOwner: false, perms: memberPerms, handoffAt, need: "manage" }).status, 403);
  assert.equal(deskAccessDenial({ isOwner: false, perms: admin, handoffAt, need: "manage" }), null);
  // Not a teammate → 404 (no existence leak); teammate but chat never handed off → 404.
  assert.equal(deskAccessDenial({ isOwner: false, perms: none, handoffAt, need: "read" }).status, 404);
  assert.equal(deskAccessDenial({ isOwner: false, perms: admin, handoffAt: null, need: "read" }).status, 404);
  assert.equal(deskAccessDenial({ isOwner: false, perms: undefined, handoffAt, need: "read" }).status, 404);
});

test("least busy: fewest waiting chats, then least recently assigned, then pool order", () => {
  assert.equal(pickLeastBusy([{ userId: "a", openCount: 3 }, { userId: "b", openCount: 1 }, { userId: "c", openCount: 2 }]), "b");
  assert.equal(
    pickLeastBusy([
      { userId: "a", openCount: 1, lastAssignedAt: "2026-09-29T10:00:00Z" },
      { userId: "b", openCount: 1, lastAssignedAt: "2026-09-29T08:00:00Z" },
    ]),
    "b"
  );
  assert.equal(pickLeastBusy([{ userId: "a", openCount: 0, lastAssignedAt: "2026-09-29T10:00:00Z" }, { userId: "b", openCount: 0 }]), "b", "never assigned goes first");
  assert.equal(pickLeastBusy([{ userId: "a" }, { userId: "b" }]), "a", "stable pool order");
  assert.equal(pickLeastBusy([]), null);
  assert.equal(pickLeastBusy(null), null);
  assert.equal(pickLeastBusy([{ openCount: 0 }, { userId: "z", openCount: 5 }]), "z", "rows without a user are ignored");
});

test("SLA first reply: none / due / overdue / met, only while waiting", () => {
  const now = new Date("2026-09-29T12:00:00Z");
  const handoffAt = "2026-09-29T11:50:00Z"; // 10 minutes ago
  assert.equal(slaState({ handoffAt, status: "WAITING_HUMAN", minutes: null, now }).state, "none");
  const due = slaState({ handoffAt, status: "WAITING_HUMAN", minutes: 15, now });
  assert.equal(due.state, "due");
  assert.equal(due.remainingMs, 5 * 60_000);
  assert.equal(due.dueAt, "2026-09-29T12:05:00.000Z");
  assert.equal(slaState({ handoffAt, status: "WAITING_HUMAN", minutes: 5, now }).state, "overdue");
  assert.equal(slaState({ handoffAt, firstHumanReplyAt: "2026-09-29T11:52:00Z", status: "WAITING_HUMAN", minutes: 5, now }).state, "met");
  assert.equal(slaState({ handoffAt, firstHumanReplyAt: "2026-09-29T11:58:00Z", status: "OPEN", minutes: 5, now }).state, "overdue", "late first reply stays a breach");
  assert.equal(slaState({ handoffAt, status: "RESOLVED", minutes: 5, now }).state, "none", "resolved without reply is not ticking");
  assert.equal(slaState({ handoffAt: "garbage", status: "WAITING_HUMAN", minutes: 5, now }).state, "none");
  assert.equal(slaState({ handoffAt: null, status: "WAITING_HUMAN", minutes: 5, now }).state, "none");
});

test("settings: invalid stored data falls back to owner routing with no SLA", () => {
  assert.deepEqual(resolveDeskSettings(null), { ...DEFAULT_DESK_SETTINGS, pool: [] });
  assert.deepEqual(resolveDeskSettings({ assignment: "robots" }), { ...DEFAULT_DESK_SETTINGS, pool: [] });
  assert.deepEqual(resolveDeskSettings({ slaFirstReplyMinutes: 2 }), { ...DEFAULT_DESK_SETTINGS, pool: [] }, "below 5 minutes is invalid");
  assert.deepEqual(resolveDeskSettings({ assignment: "least_busy", pool: [" u1 ", "u2"], slaFirstReplyMinutes: 30, extra: 1 }), {
    assignment: "least_busy",
    pool: ["u1", "u2"],
    slaFirstReplyMinutes: 30,
  });
  assert.equal(resolveDeskSettings({ slaFirstReplyMinutes: 1441 }).slaFirstReplyMinutes, null);
});
