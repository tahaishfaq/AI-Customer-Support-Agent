/**
 * Level 2 · M3 — team desk: who may do what, least-busy routing, and SLA state. Pure.
 * Authority comes only from workspace membership (resolveWorkspaceAccess); nothing here trusts
 * conversation content.
 */

import { z } from "zod";

export const DESK_ASSIGNMENT_MODES = Object.freeze(["owner", "least_busy", "manual"]);
export const DEFAULT_DESK_SETTINGS = Object.freeze({ assignment: "owner", pool: [], slaFirstReplyMinutes: null });

export const deskSettingsSchema = z
  .object({
    assignment: z.enum(DESK_ASSIGNMENT_MODES).default("owner"),
    pool: z.array(z.string().trim().min(1).max(64)).max(100).default([]),
    slaFirstReplyMinutes: z.number().int().min(5).max(1440).nullable().default(null),
  })
  .strip();

/** Stored JSON → valid settings; anything invalid falls back to today's behaviour (owner, no SLA). */
export function resolveDeskSettings(stored) {
  const parsed = deskSettingsSchema.safeParse(stored && typeof stored === "object" ? stored : {});
  return parsed.success ? parsed.data : { ...DEFAULT_DESK_SETTINGS, pool: [] };
}

const REPLY_ROLES = new Set(["OWNER", "ADMIN", "MEMBER"]);

/**
 * Desk permissions from a workspace access result ({ canRead, canManage, role }).
 * Viewers read; Owner/Admin/Member reply, claim and resolve; Owner/Admin manage routing and reassign.
 */
export function deskPermissions(access) {
  const canRead = Boolean(access?.canRead);
  const role = String(access?.role || "").toUpperCase();
  return {
    canRead,
    canReply: canRead && REPLY_ROLES.has(role),
    canManage: canRead && Boolean(access?.canManage),
  };
}

/** Workspace roles that can be assigned chats (they must be able to reply). */
export function isAssignableRole(role) {
  return REPLY_ROLES.has(String(role || "").toUpperCase());
}

/**
 * Pick the teammate with the fewest open assigned chats; ties go to whoever was assigned least
 * recently (never assigned first), then by pool order — stable, no stored cursor.
 * @param {Array<{ userId: string, openCount?: number, lastAssignedAt?: Date|string|null }>} candidates pool order
 * @returns {string|null}
 */
export function pickLeastBusy(candidates) {
  const list = (Array.isArray(candidates) ? candidates : []).filter((c) => c?.userId);
  if (!list.length) return null;
  const time = (value) => (value ? new Date(value).getTime() : -Infinity);
  return list
    .map((candidate, index) => ({ ...candidate, index, open: Number(candidate.openCount) || 0 }))
    .sort((a, b) => a.open - b.open || time(a.lastAssignedAt) - time(b.lastAssignedAt) || a.index - b.index)[0].userId;
}

/**
 * First-reply SLA for a handed-off chat.
 * @returns {{ state: "none"|"met"|"due"|"overdue", dueAt: string|null, remainingMs: number|null }}
 */
export function slaState({ handoffAt, firstHumanReplyAt, status, minutes, now = new Date() }) {
  if (!minutes || !handoffAt) return { state: "none", dueAt: null, remainingMs: null };
  const start = new Date(handoffAt).getTime();
  if (!Number.isFinite(start)) return { state: "none", dueAt: null, remainingMs: null };
  const due = start + minutes * 60_000;
  const dueAt = new Date(due).toISOString();
  if (firstHumanReplyAt) {
    return { state: new Date(firstHumanReplyAt).getTime() <= due ? "met" : "overdue", dueAt, remainingMs: null };
  }
  if (status !== "WAITING_HUMAN") return { state: "none", dueAt, remainingMs: null };
  const remainingMs = due - now.getTime();
  return { state: remainingMs < 0 ? "overdue" : "due", dueAt, remainingMs };
}

/**
 * Desk access decision (pure). Owner of the agent: full access (unchanged). Teammates: by role,
 * and only for chats handed to the desk. Returns null when allowed, else { status, message }.
 * @param {{ isOwner: boolean, perms: { canRead?: boolean, canReply?: boolean, canManage?: boolean }, handoffAt?: Date|string|null, need?: "read"|"reply"|"manage" }} input
 */
export function deskAccessDenial({ isOwner, perms, handoffAt, need = "read" }) {
  if (isOwner) return null;
  if (!perms?.canRead || !handoffAt) return { status: 404, message: "Conversation not found" };
  if ((need === "reply" && !perms.canReply) || (need === "manage" && !perms.canManage)) {
    return { status: 403, message: "Your workspace role cannot do this on the desk" };
  }
  return null;
}
