import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getAdminAgent } from "@/lib/services/admin-inspect.service";
import { writeAuditEvent } from "@/lib/services/audit.service";
import { clientIp } from "@/lib/rate-limit";

export async function GET(request, { params }) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const agent = await getAdminAgent(id);
    await writeAuditEvent({
      adminId: authResult.user.id,
      action: "AGENT_OPEN",
      targetType: "agent",
      targetId: id,
      metadata: { userId: agent.user.id, workspaceId: agent.workspace.id },
      ip: clientIp(request),
    });
    return NextResponse.json({ agent }, { status: 200 });
  } catch (error) {
    if (error.status === 404) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: 404 }
      );
    }
    console.error("GET /api/admin/agents/[id]", error);
    return NextResponse.json(
      { error: { message: "Unable to load agent", details: {} } },
      { status: 500 }
    );
  }
}
