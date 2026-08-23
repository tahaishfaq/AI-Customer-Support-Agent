import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getAdminUser } from "@/lib/services/admin-users.service";
import { hardDeleteAdminUser } from "@/lib/services/admin-user-data.service";
import { writeAuditEvent } from "@/lib/services/audit.service";
import { clientIp } from "@/lib/rate-limit";

export async function GET(_request, { params }) {
  try {
    const authResult = await requireAdmin(_request);
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const user = await getAdminUser(id);
    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    if (error.status === 404) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: 404 }
      );
    }
    console.error("GET /api/admin/users/[id]", error);
    return NextResponse.json(
      { error: { message: "Unable to load user", details: {} } },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
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

    const deleted = await hardDeleteAdminUser(id, {
      emailConfirm: body.emailConfirm,
    });
    await writeAuditEvent({
      adminId: authResult.user.id,
      action: "USER_DELETE",
      targetType: "USER",
      targetId: id,
      metadata: { email: deleted.email, name: deleted.name },
      ip: clientIp(request),
    });

    return NextResponse.json({ ok: true, deleted }, { status: 200 });
  } catch (error) {
    if (error.status === 400 || error.status === 404) {
      return NextResponse.json(
        { error: { message: error.message, details: error.details || {} } },
        { status: error.status }
      );
    }
    console.error("DELETE /api/admin/users/[id]", error);
    return NextResponse.json(
      { error: { message: "Unable to delete user", details: {} } },
      { status: 500 }
    );
  }
}
