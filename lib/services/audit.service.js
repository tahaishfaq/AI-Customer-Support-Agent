import prisma from "@/lib/prisma";

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 50;
const EXPORT_MAX = 10_000;

function parseDateBound(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function auditWhere({ action = "", targetType = "", q = "", from, to } = {}) {
  const where = {};
  const act = String(action || "").trim();
  const type = String(targetType || "").trim();
  const query = String(q || "").trim();
  if (act) where.action = act;
  if (type) where.targetType = type;
  if (query) {
    where.OR = [
      { targetId: { contains: query, mode: "insensitive" } },
      { action: { contains: query, mode: "insensitive" } },
      { ip: { contains: query, mode: "insensitive" } },
    ];
  }
  const start = parseDateBound(from);
  const end = parseDateBound(to);
  if (start || end) {
    where.createdAt = {};
    if (start) where.createdAt.gte = start;
    if (end) where.createdAt.lte = end;
  }
  return where;
}

function mapEvent(event) {
  return {
    id: event.id,
    action: event.action,
    targetType: event.targetType,
    targetId: event.targetId,
    metadata: event.metadata || null,
    ip: event.ip,
    createdAt: event.createdAt,
    admin: event.admin,
  };
}

export async function writeAuditEvent({
  adminId,
  action,
  targetType,
  targetId,
  metadata,
  ip,
}) {
  if (!adminId || !action) return null;
  try {
    return await prisma.auditEvent.create({
      data: {
        adminId,
        action: String(action).slice(0, 80),
        targetType: targetType ? String(targetType).slice(0, 40) : null,
        targetId: targetId ? String(targetId).slice(0, 80) : null,
        metadata: metadata && typeof metadata === "object" ? metadata : undefined,
        ip: ip ? String(ip).slice(0, 80) : null,
      },
    });
  } catch (error) {
    console.error("writeAuditEvent", error?.message || error);
    return null;
  }
}

export async function listAuditEvents({
  action = "",
  targetType = "",
  q = "",
  from = "",
  to = "",
  page = 1,
  pageSize = PAGE_SIZE_DEFAULT,
} = {}) {
  const where = auditWhere({ action, targetType, q, from, to });
  const size = Math.min(
    PAGE_SIZE_MAX,
    Math.max(1, Number.parseInt(pageSize, 10) || PAGE_SIZE_DEFAULT)
  );
  const currentPage = Math.max(1, Number.parseInt(page, 10) || 1);
  const skip = (currentPage - 1) * size;

  const [total, events] = await Promise.all([
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: size,
      include: {
        admin: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / size));
  return {
    events: events.map(mapEvent),
    page: currentPage,
    pageSize: size,
    total,
    totalPages,
  };
}

export async function exportAuditEvents(filters = {}) {
  const where = auditWhere(filters);
  const [total, events] = await Promise.all([
    prisma.auditEvent.count({ where }),
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: EXPORT_MAX,
      include: {
        admin: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);
  const rows = events.map(mapEvent);
  return {
    events: rows,
    total,
    truncated: total > rows.length,
    exportedAt: new Date().toISOString(),
    filters: {
      action: filters.action || "",
      targetType: filters.targetType || "",
      q: filters.q || "",
      from: filters.from || "",
      to: filters.to || "",
    },
  };
}
