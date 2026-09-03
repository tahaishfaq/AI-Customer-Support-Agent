import { getConversationQuota } from "@/lib/billing/conversation-usage.service";
import { getBillingSnapshot } from "@/lib/billing/subscription.service";

/** Admin-facing conversation quota for a product user (not ADMIN role). */
export async function getAdminConversationQuota(userId, role = "USER") {
  const [quota, billing] = await Promise.all([
    getConversationQuota(userId, role),
    getBillingSnapshot(userId, role),
  ]);

  const plan = billing.subscription?.plan;

  return {
    unlimited: quota.unlimited,
    used: quota.used,
    limit: quota.limit,
    remaining: quota.remaining,
    periodStart: quota.periodStart.toISOString(),
    periodEnd: quota.periodEnd.toISOString(),
    planType: quota.planType,
    planName: plan?.name || billing.entitlements?.planSlug || null,
    planSlug: plan?.slug || billing.entitlements?.planSlug || null,
    subscriptionStatus: billing.subscription?.status || null,
    maxConversationsPerMonth:
      plan?.maxConversationsPerMonth ??
      billing.entitlements?.maxConversationsPerMonth ??
      null,
  };
}
