import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { setAdminAgentEnabled } from "@/lib/services/admin-inspect.service";
import { writeAuditEvent } from "@/lib/services/audit.service";
import { clientIp } from "@/lib/rate-limit";

export async function POST(request, { params }) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;
    let enabled = false;
    try {
      const body = await request.json();
      if (typeof body?.enabled === "boolean") enabled = body.enabled;
    } catch {
      enabled = false;
    }

    const agent = await setAdminAgentEnabled(id, enabled);
    await writeAuditEvent({
      adminId: authResult.user.id,
      action: enabled ? "AGENT_ENABLE" : "AGENT_DISABLE",
      targetType: "agent",
      targetId: id,
      metadata: { name: agent.name },
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
    console.error("POST /api/admin/agents/[id]/disable", error);
    return NextResponse.json(
      { error: { message: "Unable to update agent", details: {} } },
      { status: 500 }
    );
  }
}
