import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { listAuditEvents } from "@/lib/services/audit.service";

export async function GET(request) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.error) return authResult.error;

    const { searchParams } = new URL(request.url);
    const result = await listAuditEvents({
      action: searchParams.get("action") || "",
      targetType: searchParams.get("targetType") || "",
      q: searchParams.get("q") || "",
      from: searchParams.get("from") || "",
      to: searchParams.get("to") || "",
      page: searchParams.get("page") || 1,
      pageSize: searchParams.get("pageSize") || 20,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("GET /api/admin/audit", error);
    return NextResponse.json(
      { error: { message: "Unable to load audit log", details: {} } },
      { status: 500 }
    );
  }
}