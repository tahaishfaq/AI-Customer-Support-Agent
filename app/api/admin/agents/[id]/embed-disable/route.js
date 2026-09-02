import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { setAdminAgentEmbedEnabled } from "@/lib/services/admin-inspect.service";
import { writeAuditEvent } from "@/lib/services/audit.service";
import { clientIp } from "@/lib/rate-limit";

export async function POST(request, { params }) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;
    let embedEnabled = false;
    try {
      const body = await request.json();
      if (typeof body?.embedEnabled === "boolean") {
        embedEnabled = body.embedEnabled;
      }
    } catch {
      embedEnabled = false;
    }

    const agent = await setAdminAgentEmbedEnabled(id, embedEnabled);
    await writeAuditEvent({
      adminId: authResult.user.id,
      action: embedEnabled ? "EMBED_ENABLE" : "EMBED_DISABLE",
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
    console.error("POST /api/admin/agents/[id]/embed-disable", error);
    return NextResponse.json(
      { error: { message: "Unable to update embed", details: {} } },
      { status: 500 }
    );
  }
}
