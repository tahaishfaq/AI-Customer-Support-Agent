import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { updateBillingPlan } from "@/lib/billing/plans.service";
import {
  updateBillingPlanSchema,
  zodErrorDetails,
} from "@/lib/validations/billing";
import { clientIp } from "@/lib/rate-limit";

export async function PATCH(request, { params }) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: { message: "Plan id required", details: {} } },
        { status: 400 }
      );
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const parsed = updateBillingPlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: "Invalid plan update",
            details: zodErrorDetails(parsed.error),
          },
        },
        { status: 400 }
      );
    }

    const plan = await updateBillingPlan(id, parsed.data, {
      adminId: authResult.user.id,
      ip: clientIp(request),
    });

    return NextResponse.json({ plan }, { status: 200 });
  } catch (error) {
    if (error.status === 400) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: 400 }
      );
    }
    if (error.status === 404) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: 404 }
      );
    }
    console.error("PATCH /api/admin/billing/plans/[id]", error);
    return NextResponse.json(
      { error: { message: "Unable to update plan", details: {} } },
      { status: 500 }
    );
  }
}
