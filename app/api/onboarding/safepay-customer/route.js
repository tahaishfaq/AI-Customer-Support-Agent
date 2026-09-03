import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { ensureSafepayCustomerForUser } from "@/lib/services/user-onboarding.service";

/**
 * Deferred SafePay customer create — kicked from the plans page so interest
 * → plans navigation is not blocked by the SafePay HTTP call.
 */
export async function POST(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const result = await ensureSafepayCustomerForUser(authResult.user.id, {
      userEmail: authResult.user.email,
    });

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    console.error("POST /api/onboarding/safepay-customer", error);
    return NextResponse.json(
      { error: { message: "Unable to create payment customer", details: {} } },
      { status: 500 }
    );
  }
}
