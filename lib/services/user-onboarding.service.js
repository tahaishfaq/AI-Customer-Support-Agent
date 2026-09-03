import prisma from "@/lib/prisma";
import { createSafepayCustomer } from "@/lib/billing/safepay-customer";
import { isSafepayConfigured } from "@/lib/billing/safepay-client";
import { crawlWebsiteBusinessProfile } from "@/lib/services/onboarding-site-profile";
import { simpleWebsiteKnowledgeName } from "@/lib/services/website-knowledge-name";

function mapOnboarding(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    country: row.country || "PK",
    websiteUrl: row.websiteUrl,
    companyType: row.companyType,
    teamSize: row.teamSize,
    monthlyConversations: row.monthlyConversations,
    primaryGoal: row.primaryGoal,
    businessProfile: row.businessProfileJson || null,
    crawlStatus: row.crawlStatus,
    crawlError: row.crawlError,
    crawledAt: row.crawledAt,
    interestCompletedAt: row.interestCompletedAt,
    completedAt: row.completedAt,
    safepayCustomerRef: row.safepayCustomerRef,
    safepayCustomerStatus: row.safepayCustomerStatus || "NONE",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Interest + SafePay profile required before plans.
 * Legacy users with completedAt (grandfathered) are treated as done.
 */
export async function needsUserOnboarding(userId, role) {
  if (role === "ADMIN") return false;

  const row = await prisma.userOnboarding.findUnique({
    where: { userId },
    select: { completedAt: true, interestCompletedAt: true },
  });
  if (!row) return true;
  if (row.interestCompletedAt || row.completedAt) return false;
  return true;
}

export async function getUserOnboarding(userId) {
  const row = await prisma.userOnboarding.findUnique({ where: { userId } });
  return mapOnboarding(row);
}

function normalizeWebsiteUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return null;
  return value;
}

/**
 * Save interest + SafePay identity fields and unlock the plan picker.
 * SafePay customer create is deferred to the plans page (user reads plans
 * while we create the customer in the background).
 */
export async function completeUserOnboarding(userId, input, { userName } = {}) {
  const websiteUrl = normalizeWebsiteUrl(input.websiteUrl);
  const firstName =
    String(input.firstName || "").trim() ||
    String(userName || "").trim().split(/\s+/)[0] ||
    "Customer";
  const lastName =
    String(input.lastName || "").trim() ||
    String(userName || "").trim().split(/\s+/).slice(1).join(" ") ||
    "User";
  const phone = String(input.phone || "").replace(/\s+/g, " ").trim();
  const country = String(input.country || "PK").trim().toUpperCase().slice(0, 2);
  const now = new Date();

  const row = await prisma.userOnboarding.upsert({
    where: { userId },
    create: {
      userId,
      firstName,
      lastName,
      phone,
      country,
      websiteUrl,
      companyType: input.companyType || null,
      teamSize: input.teamSize || null,
      monthlyConversations: input.monthlyConversations || null,
      primaryGoal: input.primaryGoal || null,
      crawlStatus: websiteUrl ? "PENDING" : "SKIPPED",
      interestCompletedAt: now,
      completedAt: now,
      safepayCustomerStatus: "NONE",
    },
    update: {
      firstName,
      lastName,
      phone,
      country,
      websiteUrl,
      companyType: input.companyType || null,
      teamSize: input.teamSize || null,
      monthlyConversations: input.monthlyConversations || null,
      primaryGoal: input.primaryGoal || null,
      crawlStatus: websiteUrl ? "PENDING" : "SKIPPED",
      crawlError: null,
      interestCompletedAt: now,
      completedAt: now,
    },
  });

  return mapOnboarding(row);
}

/**
 * Best-effort SafePay customer create — call from plans page after paint,
 * while the user is reading plans (does not block onboarding → plans nav).
 */
export async function ensureSafepayCustomerForUser(userId, { userEmail } = {}) {
  if (!isSafepayConfigured()) {
    return { ok: true, skipped: true, reason: "not_configured" };
  }

  const row = await prisma.userOnboarding.findUnique({ where: { userId } });
  if (!row) {
    return { ok: false, skipped: true, reason: "no_onboarding" };
  }
  if (row.safepayCustomerRef) {
    return {
      ok: true,
      skipped: true,
      reason: "already_created",
      token: row.safepayCustomerRef,
    };
  }

  try {
    const created = await createSafepayCustomer({
      firstName: row.firstName,
      lastName: row.lastName,
      email: userEmail,
      phone: row.phone,
      country: row.country || "PK",
    });

    if (!created?.token) {
      return { ok: false, reason: "no_token" };
    }

    await prisma.userOnboarding.update({
      where: { id: row.id },
      data: {
        safepayCustomerRef: created.token,
        safepayCustomerStatus: "CREATED",
        safepayCustomerError: null,
      },
    });

    await prisma.subscription.updateMany({
      where: { userId, safepayCustomerRef: null },
      data: { safepayCustomerRef: created.token },
    });

    return { ok: true, token: created.token };
  } catch (error) {
    await prisma.userOnboarding.update({
      where: { id: row.id },
      data: {
        safepayCustomerStatus: "FAILED",
        safepayCustomerError: String(error.message || "create failed").slice(
          0,
          500
        ),
      },
    });
    console.error("[onboarding] SafePay customer create failed", error);
    return { ok: false, reason: "create_failed" };
  }
}

/**
 * Run deferred website crawl after the user reaches the product.
 * Seeds WEB knowledge on the user's first agent when possible.
 */
export async function runDeferredOnboardingCrawl(userId) {
  const row = await prisma.userOnboarding.findUnique({ where: { userId } });
  if (!row?.websiteUrl) return { ran: false, reason: "no_url" };
  if (row.crawlStatus === "DONE") return { ran: false, reason: "already_done" };
  if (row.crawlStatus === "RUNNING") return { ran: false, reason: "running" };
  if (row.crawlStatus !== "PENDING" && row.crawlStatus !== "FAILED") {
    return { ran: false, reason: row.crawlStatus };
  }

  await prisma.userOnboarding.update({
    where: { id: row.id },
    data: { crawlStatus: "RUNNING", crawlError: null },
  });

  try {
    const profile = await crawlWebsiteBusinessProfile(row.websiteUrl);
    await prisma.userOnboarding.update({
      where: { id: row.id },
      data: {
        websiteUrl: profile.origin,
        businessProfileJson: profile,
        crawlStatus: "DONE",
        crawlError: null,
        crawledAt: new Date(),
      },
    });

    await seedWebsiteKnowledgeFromProfile(userId, profile);
    return { ran: true, status: "DONE", origin: profile.origin };
  } catch (error) {
    await prisma.userOnboarding.update({
      where: { id: row.id },
      data: {
        crawlStatus: "FAILED",
        crawlError: String(error.message || "Crawl failed").slice(0, 500),
      },
    });
    return { ran: true, status: "FAILED", error: error.message };
  }
}

async function seedWebsiteKnowledgeFromProfile(userId, profile) {
  const agent = await prisma.agent.findFirst({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!agent || !profile?.origin) return;

  const name = simpleWebsiteKnowledgeName(profile);
  const summary =
    profile.aiSummary?.summary || profile.summary || null;
  const offerings = profile.aiSummary?.offerings || profile.offerings || [];
  const content =
    [
      summary && `## About\n${summary}`,
      Array.isArray(offerings) &&
        offerings.length &&
        `## Offerings\n${offerings.map((item) => `- ${item}`).join("\n")}`,
      profile.excerpt && `## Site notes\n${profile.excerpt}`,
      `## Source\n${profile.origin}`,
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 20_000) || `Website knowledge from ${profile.origin}`;

  const existing = await prisma.knowledgeDocument.findFirst({
    where: { agentId: agent.id, type: "WEB" },
    orderBy: { createdAt: "asc" },
  });

  if (existing) {
    await prisma.knowledgeDocument.update({
      where: { id: existing.id },
      data: {
        name,
        content,
        origin: profile.origin,
        sourceUrl: profile.origin,
      },
    });
    return;
  }

  await prisma.knowledgeDocument.create({
    data: {
      agentId: agent.id,
      name,
      type: "WEB",
      content,
      origin: profile.origin,
      sourceUrl: profile.origin,
    },
  });
}
