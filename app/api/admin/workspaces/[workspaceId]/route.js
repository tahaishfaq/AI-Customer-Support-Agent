import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getAdminWorkspace } from "@/lib/services/admin-inspect.service";
import { writeAuditEvent } from "@/lib/services/audit.service";
import { clientIp } from "@/lib/rate-limit";

export async function GET(request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const { workspaceId } = await params;
    const workspace = await getAdminWorkspace(workspaceId);
    await writeAuditEvent({
      adminId: authResult.user.id,
      action: "WORKSPACE_OPEN",
      targetType: "workspace",
      targetId: workspaceId,
      metadata: { userId: workspace.user.id, name: workspace.name },
      ip: clientIp(request),
    });
    return NextResponse.json({ workspace }, { status: 200 });
  } catch (error) {
    if (error.status === 404) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: 404 }
      );
    }
    console.error("GET /api/admin/workspaces/[workspaceId]", error);
    return NextResponse.json(
      { error: { message: "Unable to load workspace", details: {} } },
      { status: 500 }
    );
  }
}
