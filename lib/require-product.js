import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { jsonError } from "@/lib/api/error-response";
import { isBillingUnlocked } from "@/lib/billing/access";
import { getBillingSnapshot } from "@/lib/billing/subscription.service";
import { subscriptionAllowsCreates } from "@/lib/billing/entitlements.service";

/**
 * Authenticated USER with billing unlocked (ADMIN bypasses).
 * Blocks new creates when subscription is PAST_DUE.
 */
export async function requireProductAccess(request = null) {
  const authResult = await requireAuth(request);
  if (authResult.error) return authResult;

  if (authResult.user.role === "ADMIN") {
    return authResult;
  }

  const billing = await getBillingSnapshot(
    authResult.user.id,
    authResult.user.role
  );

  if (!billing.unlocked) {
    return {
      error: jsonError(
        request,
        402,
        "Choose a plan to continue",
        { code: "billing_required" }
      ),
    };
  }

  if (!subscriptionAllowsCreates(billing.status)) {
    return {
      error: jsonError(
        request,
        402,
        "Your subscription is past due. Update payment in Settings → Billing.",
        { code: "billing_past_due" }
      ),
    };
  }

  return authResult;
}

/** Read access — dashboard etc. Allows PAST_DUE. */
export async function requireBillingUnlocked(request = null) {
  const authResult = await requireAuth(request);
  if (authResult.error) return authResult;

  if (authResult.user.role === "ADMIN") {
    return authResult;
  }

  const unlocked = await isBillingUnlocked(
    authResult.user.id,
    authResult.user.role
  );
  if (!unlocked) {
    return {
      error: jsonError(
        request,
        402,
        "Choose a plan to continue",
        { code: "billing_required" }
      ),
    };
  }

  return authResult;
}
