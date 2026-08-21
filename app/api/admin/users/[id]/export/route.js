import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { exportAdminUser } from "@/lib/services/admin-user-data.service";
import { writeAuditEvent } from "@/lib/services/audit.service";
import { clientIp } from "@/lib/rate-limit";

export async function GET(request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const payload = await exportAdminUser(id);
    await writeAuditEvent({
      adminId: authResult.user.id,
      action: "USER_EXPORT",
      targetType: "USER",
      targetId: id,
      metadata: { email: payload.user.email },
      ip: clientIp(request),
    });

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
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