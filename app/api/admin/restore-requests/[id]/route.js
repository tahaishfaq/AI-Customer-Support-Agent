import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { decideRestoreRequest } from "@/lib/services/restore-request.service";
import { writeAuditEvent } from "@/lib/services/audit.service";
import { clientIp } from "@/lib/rate-limit";

export async function POST(request, { params }) {
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

    const decision = String(body?.decision || "").toUpperCase();
    const restoreRequest = await decideRestoreRequest(id, decision);

    await writeAuditEvent({
      adminId: authResult.user.id,
      action: decision === "REJECT" ? "RESTORE_REQUEST_REJECT" : "RESTORE_REQUEST_APPROVE",
      targetType: "user",
      targetId: restoreRequest.userId,
      metadata: {
        requestId: restoreRequest.id,
        email: restoreRequest.user?.email,
      },
      ip: clientIp(request),
    });

    return NextResponse.json({ request: restoreRequest }, { status: 200 });
  } catch (error) {
    if (error.status === 400 || error.status === 404) {
      return NextResponse.json(
        { error: { message: error.message, details: error.details || {} } },
        { status: error.status }
      );
    }
    console.error("POST /api/admin/restore-requests/[id]", error);
    return NextResponse.json(
      { error: { message: "Unable to review request", details: {} } },
      { status: 500 }
    );
  }
}
