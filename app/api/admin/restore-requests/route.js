import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { listRestoreRequests } from "@/lib/services/restore-request.service";

export async function GET(request) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.error) return authResult.error;

    const status = request.nextUrl.searchParams.get("status") || "PENDING";
    const requests = await listRestoreRequests({ status });
    return NextResponse.json({ requests }, { status: 200 });
  } catch (error) {
    console.error("GET /api/admin/restore-requests", error);
    return NextResponse.json(
      { error: { message: "Unable to load requests", details: {} } },
      { status: 500 }
    );
  }
}
