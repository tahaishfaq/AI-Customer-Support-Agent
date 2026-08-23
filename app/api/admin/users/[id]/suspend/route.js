import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { setUserStatus } from "@/lib/services/admin-users.service";
import { writeAuditEvent } from "@/lib/services/audit.service";
import { clientIp } from "@/lib/rate-limit";

export async function POST(request, { params }) {
  let adminId = null;
  let targetId = null;
  try {
    const authResult = await requireAdmin(request);
    if (authResult.error) return authResult.error;
    adminId = authResult.user.id;

    const { id } = await params;
    targetId = id;
    const user = await setUserStatus(id, "SUSPENDED", {
      actorId: authResult.user.id,
    });
    await writeAuditEvent({
      adminId: authResult.user.id,
      action: "USER_SUSPEND",
      targetType: "user",
      targetId: id,
      metadata: { email: user.email },
      ip: clientIp(request),
    });
    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    if (adminId && targetId) {
      await writeAuditEvent({
        adminId,
        action: "USER_SUSPEND_FAILED",
        targetType: "user",
        targetId,
        metadata: {
          reason: error.message || "Unable to suspend user",
          status: error.status || 500,
        },
        ip: clientIp(request),
      });
    }
    if (error.status === 400 || error.status === 404) {
      return NextResponse.json(
        { error: { message: error.message, details: error.details || {} } },
        { status: error.status }
      );
    }
    console.error("POST /api/admin/users/[id]/suspend", error);
    return NextResponse.json(
      { error: { message: "Unable to suspend user", details: {} } },
      { status: 500 }
    );
  }
}
