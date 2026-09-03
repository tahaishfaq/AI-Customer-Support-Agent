import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import {
  listAdminBillingPlans,
} from "@/lib/billing/plans.service";

export async function GET(request) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.error) return authResult.error;

    const plans = await listAdminBillingPlans();
    return NextResponse.json({ plans }, { status: 200 });
  } catch (error) {
    console.error("GET /api/admin/billing/plans", error);
    return NextResponse.json(
      { error: { message: "Unable to load billing plans", details: {} } },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.error) return authResult.error;

    return NextResponse.json(
      {
        error: {
          message: "billing_plan_cap_reached",
          details: { cap: 4 },
        },
      },
      { status: 409 }
    );
  } catch (error) {
    console.error("POST /api/admin/billing/plans", error);
    return NextResponse.json(
      { error: { message: "Unable to create plan", details: {} } },
      { status: 500 }
    );
  }
}
