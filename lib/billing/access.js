import { getBillingSnapshot } from "@/lib/billing/subscription.service";

export async function resolveBillingAccess(userId, role) {
  return getBillingSnapshot(userId, role);
}

export async function isBillingUnlocked(userId, role) {
  const access = await getBillingSnapshot(userId, role);
  return access.unlocked;
}
