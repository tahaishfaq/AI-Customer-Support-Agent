import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { listCustomPlanRequests } from "@/lib/billing/custom-request.service";

export async function GET(request) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.error) return authResult.error;

    const status = request.nextUrl.searchParams.get("status") || "";
    const requests = await listCustomPlanRequests({ status });
    return NextResponse.json({ requests }, { status: 200 });
  } catch (error) {
    console.error("GET /api/admin/billing/requests", error);
    return NextResponse.json(
      { error: { message: "Unable to load custom plan requests", details: {} } },
      { status: 500 }
    );
  }
}
