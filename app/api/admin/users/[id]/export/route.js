import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { exportAdminUser } from "@/lib/services/admin-user-data.service";
import { writeAuditEvent } from "@/lib/services/audit.service";
import { clientIp } from "@/lib/rate-limit";

export async function GET(request, { params }) {
  let adminId = null;
  let targetId = null;
  try {
    const authResult = await requireAdmin(request);
    if (authResult.error) return authResult.error;
    adminId = authResult.user.id;

    const { id } = await params;
    targetId = id;
    const payload = await exportAdminUser(id);
    await writeAuditEvent({
      adminId: authResult.user.id,
      action: "USER_EXPORT",
      targetType: "USER",
      targetId: id,
      metadata: {
        email: payload.user.email,
        truncated: Boolean(payload.truncated),
      },
      ip: clientIp(request),
    });

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    if (adminId && targetId) {
      await writeAuditEvent({
        adminId,
        action: "USER_EXPORT_FAILED",
        targetType: "USER",
        targetId,
        metadata: {
          reason: error.message || "Unable to export user",
          status: error.status || 500,
        },
        ip: clientIp(request),
      });
    }
    if (error.status === 404) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: 404 }
      );
    }
    console.error("GET /api/admin/users/[id]/export", error);
    return NextResponse.json(
      { error: { message: "Unable to export user", details: {} } },
      { status: 500 }
    );
  }
}