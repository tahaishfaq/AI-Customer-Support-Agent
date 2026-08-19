import prisma from "@/lib/prisma";

function httpError(status, message, details = {}) {
  const err = new Error(message);
  err.status = status;
  err.details = details;
  return err;
}

function toRequest(row) {
  return {
    id: row.id,
    message: row.message,
    status: row.status,
    createdAt: row.createdAt,
    user: row.user
      ? {
          id: row.user.id,
          name: row.user.name,
          email: row.user.email,
          status: row.user.status,
        }
      : undefined,
    userId: row.userId,
  };
}

export async function createRestoreRequest({ email, message }) {
  const text = String(message || "").trim();
  if (text.length < 10) {
    throw httpError(400, "Please explain why you need access (at least 10 characters)");
  }
  if (text.length > 2000) {
    throw httpError(400, "Message is too long");
  }

  const user = await prisma.user.findUnique({
    where: { email: String(email || "").trim().toLowerCase() },
    select: { id: true, status: true, role: true },
  });

  if (!user || user.status !== "SUSPENDED" || user.role === "ADMIN") {
    throw httpError(400, "This account is not suspended");
  }

  const existing = await prisma.restoreRequest.findFirst({
    where: { userId: user.id, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    const updated = await prisma.restoreRequest.update({
      where: { id: existing.id },
      data: { message: text },
    });
    return toRequest(updated);
  }

  const created = await prisma.restoreRequest.create({
    data: { userId: user.id, message: text },
  });
  return toRequest(created);
}

export async function listRestoreRequests({ status = "PENDING" } = {}) {
  const where = {};
  if (status === "PENDING" || status === "APPROVED" || status === "REJECTED") {
    where.status = status;
  }
  const rows = await prisma.restoreRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 80,
    include: {
      user: { select: { id: true, name: true, email: true, status: true } },
    },
  });
  return rows.map(toRequest);
}

export async function getLatestRestoreRequest(userId) {
  const row = await prisma.restoreRequest.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return row ? toRequest(row) : null;
}

export async function approvePendingRestoreRequestsForUser(userId) {
  await prisma.restoreRequest.updateMany({
    where: { userId, status: "PENDING" },
    data: { status: "APPROVED" },
  });
}

export async function decideRestoreRequest(id, decision) {
  if (decision !== "APPROVE" && decision !== "REJECT") {
    throw httpError(400, "Choose restore or reject");
  }

  const row = await prisma.restoreRequest.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, status: true, role: true } },
    },
  });
  if (!row) {
    throw httpError(404, "Request not found");
  }
  if (row.status !== "PENDING") {
    throw httpError(400, "This request was already reviewed");
  }
  if (row.user.role === "ADMIN") {
    throw httpError(400, "The platform admin cannot be changed from a request");
  }

  if (decision === "REJECT") {
    const updated = await prisma.restoreRequest.update({
      where: { id },
      data: { status: "REJECTED" },
      include: {
        user: { select: { id: true, name: true, email: true, status: true } },
      },
    });
    return toRequest(updated);
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { status: "ACTIVE" },
    }),
    prisma.restoreRequest.update({
      where: { id },
      data: { status: "APPROVED" },
    }),
    prisma.restoreRequest.updateMany({
      where: { userId: row.userId, status: "PENDING", id: { not: id } },
      data: { status: "APPROVED" },
    }),
  ]);

  const updated = await prisma.restoreRequest.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, status: true } },
    },
  });
  return toRequest(updated);
}
