import prisma from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/services/audit.service";
import {
  BILLING_PLAN_CAP,
  BILLING_PLAN_TYPES,
  DEFAULT_BILLING_PLANS,
  PRODUCT_UNLOCK_STATUSES,
} from "@/lib/billing/constants";
import { isPlanComingSoon } from "@/lib/billing/plan-labels";

function normalizeFeaturesJson(value) {
  if (value == null) return null;
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return null;
}

export function mapPlanToPublic(plan) {
  return {
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    description: plan.description,
    planType: plan.planType,
    isPopular: plan.isPopular,
    priceMinor: plan.priceMinor,
    currency: plan.currency,
    interval: plan.interval,
    maxWorkspaces: plan.maxWorkspaces,
    maxAgentsPerWorkspace: plan.maxAgentsPerWorkspace,
    maxConversationsPerMonth: plan.maxConversationsPerMonth,
    features: normalizeFeaturesJson(plan.featuresJson) || [],
    sortOrder: plan.sortOrder,
    isDefault: plan.isDefault,
    isContactUs: plan.planType === "CUSTOM",
    comingSoon: isPlanComingSoon(plan),
  };
}

export function mapPlanToAdmin(plan, { subscriberCount = 0 } = {}) {
  return {
    ...mapPlanToPublic(plan),
    safepayPlanId: plan.safepayPlanId,
    isActive: plan.isActive,
    featuresJson: normalizeFeaturesJson(plan.featuresJson),
    subscriberCount,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

async function subscriberCountsByPlanId(planIds) {
  if (!planIds.length) return new Map();
  const rows = await prisma.subscription.groupBy({
    by: ["planId"],
    where: {
      planId: { in: planIds },
      status: { in: PRODUCT_UNLOCK_STATUSES },
    },
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.planId, row._count._all]));
}

async function mapPlansToAdminWithSubscribers(plans) {
  const counts = await subscriberCountsByPlanId(plans.map((p) => p.id));
  return plans.map((plan) =>
    mapPlanToAdmin(plan, { subscriberCount: counts.get(plan.id) || 0 })
  );
}

function validatePlanConfig(planType, patch) {
  const safepayPlanId =
    patch.safepayPlanId !== undefined
      ? patch.safepayPlanId
      : undefined;
  const isPopular =
    patch.isPopular !== undefined ? patch.isPopular : undefined;

  if (planType === "FREE" || planType === "CUSTOM") {
    if (safepayPlanId) {
      const err = new Error("Basic and Custom plans cannot have a SafePay plan id");
      err.status = 400;
      throw err;
    }
  }

  if (planType === "POPULAR" || planType === "TEAMS") {
    if (safepayPlanId === "") {
      const err = new Error("Paid plans require a SafePay plan id for checkout");
      err.status = 400;
      throw err;
    }
  }

  if (isPopular === true && planType !== "POPULAR") {
    const err = new Error("Only the Popular plan can show the Popular badge");
    err.status = 400;
    throw err;
  }

  if (patch.isDefault === true && planType !== "FREE") {
    const err = new Error("Only the Basic plan can be the default");
    err.status = 400;
    throw err;
  }
}

export async function seedBillingPlans() {
  const results = [];
  for (const seed of DEFAULT_BILLING_PLANS) {
    // Create missing slots only — never overwrite admin-edited limits/copy/price.
    const plan = await prisma.billingPlan.upsert({
      where: { planType: seed.planType },
      create: {
        ...seed,
        featuresJson: seed.featuresJson,
      },
      update: {},
    });
    results.push(plan);
  }

  await prisma.billingPlan.updateMany({
    where: { planType: { not: "FREE" } },
    data: { isDefault: false },
  });
  await prisma.billingPlan.updateMany({
    where: { planType: "FREE" },
    data: { isDefault: true },
  });

  return mapPlansToAdminWithSubscribers(results);
}

export async function listPublicBillingPlans() {
  await seedBillingPlans();
  const plans = await prisma.billingPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  return plans.map(mapPlanToPublic);
}

export async function listAdminBillingPlans() {
  await seedBillingPlans();
  const plans = await prisma.billingPlan.findMany({
    orderBy: { sortOrder: "asc" },
  });
  return mapPlansToAdminWithSubscribers(plans);
}

export async function getBillingPlanById(id) {
  return prisma.billingPlan.findUnique({ where: { id } });
}

export async function assertBillingPlanCapNotReached() {
  const count = await prisma.billingPlan.count();
  if (count >= BILLING_PLAN_CAP) {
    const err = new Error("billing_plan_cap_reached");
    err.status = 409;
    throw err;
  }
}

export async function updateBillingPlan(id, patch, { adminId, ip } = {}) {
  const existing = await getBillingPlanById(id);
  if (!existing) {
    const err = new Error("Plan not found");
    err.status = 404;
    throw err;
  }

  validatePlanConfig(existing.planType, patch);

  const data = {};

  if (patch.name !== undefined) data.name = String(patch.name).trim();
  if (patch.description !== undefined) {
    data.description = patch.description
      ? String(patch.description).trim()
      : null;
  }
  if (patch.isPopular !== undefined) data.isPopular = Boolean(patch.isPopular);
  if (patch.priceMinor !== undefined) {
    data.priceMinor = Math.max(0, Number.parseInt(patch.priceMinor, 10) || 0);
  }
  if (patch.currency !== undefined) {
    data.currency = String(patch.currency).trim().toUpperCase().slice(0, 8);
  }
  if (patch.interval !== undefined) data.interval = patch.interval;
  if (patch.safepayPlanId !== undefined) {
    data.safepayPlanId = patch.safepayPlanId
      ? String(patch.safepayPlanId).trim()
      : null;
  }
  if (patch.maxWorkspaces !== undefined) {
    data.maxWorkspaces = Math.max(0, Number.parseInt(patch.maxWorkspaces, 10) || 0);
  }
  if (patch.maxAgentsPerWorkspace !== undefined) {
    data.maxAgentsPerWorkspace = Math.max(
      0,
      Number.parseInt(patch.maxAgentsPerWorkspace, 10) || 0
    );
  }
  if (patch.maxConversationsPerMonth !== undefined) {
    data.maxConversationsPerMonth = Math.max(
      0,
      Number.parseInt(patch.maxConversationsPerMonth, 10) || 0
    );
  }
  if (patch.featuresJson !== undefined) {
    data.featuresJson = normalizeFeaturesJson(patch.featuresJson);
  }
  if (patch.isActive !== undefined) data.isActive = Boolean(patch.isActive);
  if (patch.isDefault !== undefined) data.isDefault = Boolean(patch.isDefault);

  const [existingMapped] = await mapPlansToAdminWithSubscribers([existing]);

  if (Object.keys(data).length === 0) {
    return existingMapped;
  }

  if (data.isDefault) {
    await prisma.billingPlan.updateMany({
      data: { isDefault: false },
      where: { id: { not: id } },
    });
  }

  if (existing.planType === "POPULAR" && data.isPopular === false) {
    data.isPopular = true;
  }

  const updated = await prisma.billingPlan.update({
    where: { id },
    data,
  });

  const [updatedMapped] = await mapPlansToAdminWithSubscribers([updated]);

  if (adminId) {
    await writeAuditEvent({
      adminId,
      action: "BILLING_PLAN_UPDATE",
      targetType: "billing_plan",
      targetId: id,
      metadata: {
        planType: existing.planType,
        subscriberCount: updatedMapped.subscriberCount,
        previous: existingMapped,
        next: updatedMapped,
        liveEntitlements: true,
      },
      ip,
    });
  }

  return updatedMapped;
}

export function billingPlanTypesForTests() {
  return [...BILLING_PLAN_TYPES];
}
