import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getAdminConversation } from "@/lib/services/admin-inspect.service";
import { writeAuditEvent } from "@/lib/services/audit.service";
import { clientIp } from "@/lib/rate-limit";

export async function GET(request, { params }) {
  try {
    const authResult = await requireAdmin(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const conversation = await getAdminConversation(id);
    await writeAuditEvent({
      adminId: authResult.user.id,
      action: "CONVERSATION_OPEN",
      targetType: "conversation",
      targetId: id,
      metadata: {
        agentId: conversation.agentId,
        userId: conversation.user?.id,
      },
      ip: clientIp(request),
    });
    return NextResponse.json({ conversation }, { status: 200 });
  } catch (error) {
    if (error.status === 404) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: 404 }
      );
    }
    console.error("GET /api/admin/conversations/[id]", error);
    return NextResponse.json(
      { error: { message: "Unable to load conversation", details: {} } },
      { status: 500 }
    );
  }
}
