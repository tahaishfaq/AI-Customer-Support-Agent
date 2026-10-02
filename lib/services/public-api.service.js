/**
 * Level 2 · P7 — read-only REST API v1. Every query is scoped to the API key's workspace; ids from
 * other workspaces are 404. Internal (team-only) notes are never returned.
 */

import prisma from "@/lib/prisma";

const STATUSES = new Set(["OPEN", "WAITING_HUMAN", "RESOLVED"]);

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function parseLimit(value, fallback = 25) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? Math.min(n, 100) : fallback;
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw httpError(400, "Invalid date (use ISO 8601)");
  return date;
}

/** Opaque cursor: base64url("createdAtISO|id"). */
function encodeCursor(row) {
  return Buffer.from(`${new Date(row.createdAt).toISOString()}|${row.id}`).toString("base64url");
}

function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const [at, id] = Buffer.from(String(cursor), "base64url").toString("utf8").split("|");
    const date = new Date(at);
    if (!id || Number.isNaN(date.getTime())) throw new Error("bad");
    return { createdAt: date, id };
  } catch {
    throw httpError(400, "Invalid cursor");
  }
}

export async function apiListAgents(workspaceId) {
  const agents = await prisma.agent.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, description: true, enabled: true, embedEnabled: true, createdAt: true, updatedAt: true },
  });
  return { data: agents };
}

/** Newest first. Filters: agentId, status, since (ISO). Cursor pagination. */
export async function apiListConversations(workspaceId, query = {}) {
  const limit = parseLimit(query.limit);
  const cursor = decodeCursor(query.cursor);
  const since = parseDate(query.since);
  const status = query.status ? String(query.status).toUpperCase() : null;
  if (status && !STATUSES.has(status)) throw httpError(400, "status must be OPEN, WAITING_HUMAN or RESOLVED");
  const where = {
    agent: { workspaceId },
    source: { not: "STUDIO" },
    ...(query.agentId ? { agentId: String(query.agentId) } : {}),
    ...(status ? { status } : {}),
    ...(since ? { createdAt: { gte: since } } : {}),
    ...(cursor
      ? { OR: [{ createdAt: { lt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { lt: cursor.id } }] }
      : {}),
  };
  const rows = await prisma.conversation.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true, agentId: true, source: true, status: true, category: true, sentiment: true,
      csatScore: true, handoffCount: true, handoffAt: true, resolvedBy: true, createdAt: true, endedAt: true,
    },
  });
  const page = rows.slice(0, limit);
  return { data: page, nextCursor: rows.length > limit ? encodeCursor(page[page.length - 1]) : null };
}

/** Oldest first; internal notes excluded. */
export async function apiListMessages(workspaceId, conversationId, query = {}) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: String(conversationId), agent: { workspaceId } },
    select: { id: true },
  });
  if (!conversation) throw httpError(404, "Conversation not found");
  const limit = parseLimit(query.limit, 50);
  const cursor = decodeCursor(query.cursor);
  const rows = await prisma.message.findMany({
    where: {
      conversationId: conversation.id,
      role: { not: "INTERNAL" },
      ...(cursor ? { OR: [{ createdAt: { gt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { gt: cursor.id } }] } : {}),
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: limit + 1,
    select: { id: true, role: true, content: true, createdAt: true },
  });
  const page = rows.slice(0, limit);
  return { data: page, nextCursor: rows.length > limit ? encodeCursor(page[page.length - 1]) : null };
}
