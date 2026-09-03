import prisma from "@/lib/prisma";
import { getPlatformSettings } from "@/lib/services/platform-settings.service";
import { OPEN_SUBSCRIPTION_STATUSES } from "@/lib/billing/constants";
import { subscriptionUnlocksProduct } from "@/lib/billing/subscription.service";

/**
 * One round-trip for app layout gates (status, billing, onboarding, maintenance).
 */
export async function getAppAccessGate(userId, role) {
  if (role === "ADMIN") {
    return {
      row: { status: "ACTIVE", role: "ADMIN" },
      maintenanceMode: false,
      billingUnlocked: true,
      needsOnboarding: false,
    };
  }

  const [settings, row] = await Promise.all([
    getPlatformSettings(),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        status: true,
        role: true,
        subscriptions: {
          where: { status: { in: OPEN_SUBSCRIPTION_STATUSES } },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true },
        },
        onboarding: {
          select: { completedAt: true, interestCompletedAt: true },
        },
      },
    }),
  ]);

  const subscription = row?.subscriptions?.[0];
  const billingUnlocked = subscription
    ? subscriptionUnlocksProduct(subscription.status)
    : false;

  const onboardingDone = Boolean(
    row?.onboarding?.interestCompletedAt || row?.onboarding?.completedAt
  );

  return {
    row: row ? { status: row.status, role: row.role || "USER" } : null,
    maintenanceMode: Boolean(settings.maintenanceMode),
    billingUnlocked,
    needsOnboarding: row ? !onboardingDone : false,
  };
}
