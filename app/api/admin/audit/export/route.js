import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { exportAuditEvents, writeAuditEvent } from "@/lib/services/audit.service";
import { clientIp } from "@/lib/rate-limit";

export async function GET(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const { searchParams } = new URL(request.url);
    const payload = await exportAuditEvents({
      action: searchParams.get("action") || "",
      targetType: searchParams.get("targetType") || "",
      q: searchParams.get("q") || "",
      from: searchParams.get("from") || "",
      to: searchParams.get("to") || "",
    });

    await writeAuditEvent({
      adminId: authResult.user.id,
      action: "AUDIT_EXPORT",
      targetType: "AUDIT",
      metadata: {
        format: searchParams.get("format") || "json",
        count: payload.events.length,
        truncated: payload.truncated,
      },
      ip: clientIp(request),
    });

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error("GET /api/admin/audit/export", error);
    return NextResponse.json(
      { error: { message: "Unable to export audit log", details: {} } },
      { status: 500 }
    );
  }
}
