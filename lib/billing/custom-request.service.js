import prisma from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/services/audit.service";
import {
  CUSTOM_REQUEST_LIMIT_PER_DAY,
  CUSTOM_REQUEST_WINDOW_MS,
} from "@/lib/billing/constants";

function mapRequest(row) {
  return {
    id: row.id,
    userId: row.userId,
    planId: row.planId,
    companyName: row.companyName,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    phone: row.phone,
    estimatedSeats: row.estimatedSeats,
    useCase: row.useCase,
    message: row.message,
    status: row.status,
    adminNotes: row.adminNotes,
    handledByAdminId: row.handledByAdminId,
    handledAt: row.handledAt,
    emailSentAt: row.emailSentAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    user: row.user
      ? {
          id: row.user.id,
          name: row.user.name,
          email: row.user.email,
        }
      : null,
    plan: row.plan
      ? {
          id: row.plan.id,
          slug: row.plan.slug,
          name: row.plan.name,
          planType: row.plan.planType,
        }
      : null,
    handledByAdmin: row.handledByAdmin
      ? {
          id: row.handledByAdmin.id,
          name: row.handledByAdmin.name,
          email: row.handledByAdmin.email,
        }
      : null,
  };
}

async function notifyCustomPlanRequest(request) {
  const to = process.env.BILLING_ADMIN_EMAIL?.trim();
  if (!to) {
    console.log(
      "[billing] custom plan request saved (set BILLING_ADMIN_EMAIL for email):",
      request.id
    );
    return { sent: false };
  }

  // Resend wiring lands in EMAIL_RESEND_PLAN — B0 logs until EM2 is ready.
  console.log(
    `[billing] custom plan request ${request.id} — would email ${to} (Resend stub)`
  );
  return { sent: false };
}

export async function countRecentCustomRequests(userId) {
  const since = new Date(Date.now() - CUSTOM_REQUEST_WINDOW_MS);
  return prisma.customPlanRequest.count({
    where: {
      userId,
      createdAt: { gte: since },
    },
  });
}

export async function createCustomPlanRequest(userId, body) {
  const recent = await countRecentCustomRequests(userId);
  if (recent >= CUSTOM_REQUEST_LIMIT_PER_DAY) {
    const err = new Error("Too many custom plan requests. Try again tomorrow.");
    err.status = 429;
    throw err;
  }

  let planId = body.planId || null;
  if (planId) {
    const plan = await prisma.billingPlan.findUnique({
      where: { id: planId },
      select: { id: true, planType: true, isActive: true },
    });
    if (!plan || plan.planType !== "CUSTOM" || !plan.isActive) {
      const err = new Error("Invalid custom plan");
      err.status = 400;
      throw err;
    }
  } else {
    const customPlan = await prisma.billingPlan.findFirst({
      where: { planType: "CUSTOM", isActive: true },
      select: { id: true },
    });
    planId = customPlan?.id || null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  if (!user?.email) {
    const err = new Error("User email required");
    err.status = 400;
    throw err;
  }

  const row = await prisma.customPlanRequest.create({
    data: {
      userId,
      planId,
      companyName: body.companyName || null,
      contactName: body.contactName || user.name || null,
      contactEmail: body.contactEmail || user.email,
      phone: body.phone || null,
      estimatedSeats:
        body.estimatedSeats != null
          ? Math.max(1, Number.parseInt(body.estimatedSeats, 10) || 1)
          : null,
      useCase: body.useCase || null,
      message: body.message,
      status: "NEW",
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      plan: { select: { id: true, slug: true, name: true, planType: true } },
    },
  });

  const notify = await notifyCustomPlanRequest(row);
  if (notify.sent) {
    await prisma.customPlanRequest.update({
      where: { id: row.id },
      data: { emailSentAt: new Date() },
    });
  }

  return mapRequest(row);
}

export async function listCustomPlanRequests({ status = "" } = {}) {
  const where = {};
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized && normalized !== "ALL") {
    where.status = normalized;
  }

  const rows = await prisma.customPlanRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { id: true, name: true, email: true } },
      plan: { select: { id: true, slug: true, name: true, planType: true } },
      handledByAdmin: { select: { id: true, name: true, email: true } },
    },
  });

  return rows.map(mapRequest);
}

export async function getCustomPlanRequest(id) {
  const row = await prisma.customPlanRequest.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      plan: { select: { id: true, slug: true, name: true, planType: true } },
      handledByAdmin: { select: { id: true, name: true, email: true } },
    },
  });
  return row ? mapRequest(row) : null;
}

export async function updateCustomPlanRequest(
  id,
  patch,
  { adminId, ip } = {}
) {
  const existing = await prisma.customPlanRequest.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      plan: { select: { id: true, slug: true, name: true, planType: true } },
      handledByAdmin: { select: { id: true, name: true, email: true } },
    },
  });
  if (!existing) {
    const err = new Error("Request not found");
    err.status = 404;
    throw err;
  }

  const data = {};
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.adminNotes !== undefined) {
    data.adminNotes = patch.adminNotes
      ? String(patch.adminNotes).trim()
      : null;
  }
  if (patch.status && patch.status !== existing.status) {
    data.handledByAdminId = adminId || null;
    data.handledAt = new Date();
  }

  const updated = await prisma.customPlanRequest.update({
    where: { id },
    data,
    include: {
      user: { select: { id: true, name: true, email: true } },
      plan: { select: { id: true, slug: true, name: true, planType: true } },
      handledByAdmin: { select: { id: true, name: true, email: true } },
    },
  });

  if (adminId) {
    await writeAuditEvent({
      adminId,
      action: "BILLING_CUSTOM_REQUEST_UPDATE",
      targetType: "custom_plan_request",
      targetId: id,
      metadata: {
        previousStatus: existing.status,
        nextStatus: updated.status,
      },
      ip,
    });
  }

  return mapRequest(updated);
}
