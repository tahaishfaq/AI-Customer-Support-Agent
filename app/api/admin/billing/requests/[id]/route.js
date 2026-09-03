import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import {
  getCustomPlanRequest,
  updateCustomPlanRequest,
} from "@/lib/billing/custom-request.service";
import {
  updateCustomPlanRequestSchema,
  zodErrorDetails,
} from "@/lib/validations/billing";
import { clientIp } from "@/lib/rate-limit";

export async function GET(request, { params }) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const row = await getCustomPlanRequest(id);
    if (!row) {
      return NextResponse.json(
        { error: { message: "Request not found", details: {} } },
        { status: 404 }
      );
    }

    return NextResponse.json({ request: row }, { status: 200 });
  } catch (error) {
    console.error("GET /api/admin/billing/requests/[id]", error);
    return NextResponse.json(
      { error: { message: "Unable to load request", details: {} } },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const parsed = updateCustomPlanRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: "Invalid update",
            details: zodErrorDetails(parsed.error),
          },
        },
        { status: 400 }
      );
    }

    const row = await updateCustomPlanRequest(id, parsed.data, {
      adminId: authResult.user.id,
      ip: clientIp(request),
    });

    return NextResponse.json({ request: row }, { status: 200 });
  } catch (error) {
    if (error.status === 404) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: 404 }
      );
    }
    console.error("PATCH /api/admin/billing/requests/[id]", error);
    return NextResponse.json(
      { error: { message: "Unable to update request", details: {} } },
      { status: 500 }
    );
  }
}
