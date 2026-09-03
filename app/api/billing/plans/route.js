import { NextResponse } from "next/server";
import { isSafepayConfigured } from "@/lib/billing/safepay-client";
import { listPublicBillingPlans } from "@/lib/billing/plans.service";

export async function GET() {
  try {
    const plans = await listPublicBillingPlans();
    return NextResponse.json(
      {
        plans,
        paymentsAvailable: isSafepayConfigured(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/billing/plans", error);
    return NextResponse.json(
      { error: { message: "Unable to load plans", details: {} } },
      { status: 500 }
    );
  }
}
