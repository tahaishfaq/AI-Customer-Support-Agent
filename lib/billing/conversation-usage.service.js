import prisma from "@/lib/prisma";
import { getBillingSnapshot } from "@/lib/billing/subscription.service";

/**
 * Botpress-style billing month (calendar month, UTC).
 * A billable conversation = 2+ end-user (USER role) messages in the period
 * on an EMBED (public site widget) conversation. Studio / test chats never count.
 */
export function getCurrentBillingMonthWindow(now = new Date()) {
  const periodStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  );
  const periodEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  );
  return { periodStart, periodEnd };
}

export async function countBillableConversations(
  userId,
  periodStart,
  periodEnd,
  db = prisma
) {
  const rows = await db.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM (
      SELECT c.id
      FROM "Conversation" c
      INNER JOIN "Agent" a ON a.id = c."agentId"
      INNER JOIN "Message" m ON m."conversationId" = c.id
      WHERE a."userId" = ${userId}
        AND c."source" = 'EMBED'::"ConversationSource"
        AND m.role = 'USER'::"MessageRole"
        AND m."createdAt" >= ${periodStart}
        AND m."createdAt" < ${periodEnd}
      GROUP BY c.id
      HAVING COUNT(*) >= 2
    ) billable
  `;
  return rows[0]?.count ?? 0;
}

/** Build the safe owner-room snapshot emitted after an authoritative quota change. */
export async function getQuotaRealtimePayload(db, userId, role, now = new Date()) {
  const { periodStart, periodEnd } = getCurrentBillingMonthWindow(now);
  if (role === "ADMIN") {
    return {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      unlimited: true,
      used: 0,
      limit: null,
      remaining: null,
      planType: null,
    };
  }

  const subscription = await db.subscription.findFirst({
    where: { userId, status: { in: ["PENDING", "ACTIVE", "PAST_DUE"] } },
    orderBy: { createdAt: "desc" },
    select: { plan: { select: { planType: true, maxConversationsPerMonth: true } } },
  });
  const limit = subscription?.plan?.maxConversationsPerMonth || 0;
  const used = await countBillableConversations(userId, periodStart, periodEnd, db);
  const unlimited = limit <= 0;
  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    unlimited,
    used,
    limit: unlimited ? null : limit,
    remaining: unlimited ? null : Math.max(0, limit - used),
    planType: subscription?.plan?.planType || null,
  };
}

async function countUserMessagesInPeriod(
  conversationId,
  periodStart,
  periodEnd
) {
  return prisma.message.count({
    where: {
      conversationId,
      role: "USER",
      createdAt: { gte: periodStart, lt: periodEnd },
    },
  });
}

function conversationLimitExceededError(quota) {
  const err = new Error(
    `Monthly conversation limit reached (${quota.used}/${quota.limit}). Upgrade your plan or wait until next month.`
  );
  err.status = 402;
  err.code = "conversation_limit_reached";
  err.quota = quota;
  return err;
}

/**
 * @returns {Promise<{
 *   unlimited: boolean,
 *   used: number,
 *   limit: number|null,
 *   remaining: number|null,
 *   periodStart: Date,
 *   periodEnd: Date,
 *   planType: string|null,
 * }>}
 */
/**
 * @param {string} userId
 * @param {string} role
 * @param {{ billing?: object }} [options] Pass a preloaded billing snapshot to avoid a duplicate query.
 */
export async function getConversationQuota(userId, role, options = {}) {
  const { periodStart, periodEnd } = getCurrentBillingMonthWindow();

  if (role === "ADMIN") {
    return {
      unlimited: true,
      used: 0,
      limit: null,
      remaining: null,
      periodStart,
      periodEnd,
      planType: null,
    };
  }

  const billing =
    options.billing ?? (await getBillingSnapshot(userId, role));
  const planType = billing.entitlements?.planType || null;
  const limit = billing.entitlements?.maxConversationsPerMonth ?? 0;
  const used = await countBillableConversations(userId, periodStart, periodEnd);

  if (!limit || limit <= 0) {
    return {
      unlimited: true,
      used,
      limit: null,
      remaining: null,
      periodStart,
      periodEnd,
      planType,
    };
  }

  return {
    unlimited: false,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    periodStart,
    periodEnd,
    planType,
  };
}

/**
 * Enforce quota before starting a chat or adding a visitor message.
 */
export async function assertConversationQuota(
  ownerUserId,
  ownerRole,
  { conversationId = null, isNewConversation = false } = {}
) {
  const quota = await getConversationQuota(ownerUserId, ownerRole);
  if (quota.unlimited) return quota;

  if (isNewConversation) {
    if (quota.used >= quota.limit) {
      throw conversationLimitExceededError(quota);
    }
    return quota;
  }

  if (!conversationId) return quota;

  const userMsgsInPeriod = await countUserMessagesInPeriod(
    conversationId,
    quota.periodStart,
    quota.periodEnd
  );

  if (userMsgsInPeriod >= 2) {
    return quota;
  }

  if (userMsgsInPeriod === 1 && quota.used >= quota.limit) {
    throw conversationLimitExceededError(quota);
  }

  return quota;
}
