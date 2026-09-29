import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/require-auth";
import { assignConversation } from "@/lib/services/handoff.service";
import { zodErrorDetails } from "@/lib/validations/desk";

const assignBodySchema = z.object({
  assigneeId: z.string().trim().min(1).max(64).nullable(),
});

/** Assign a desk chat to a teammate (or null to unassign). Level 2 · M3. */
export async function PATCH(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    if (authResult.user.role === "ADMIN") {
      return NextResponse.json(
        { error: { message: "Platform admin cannot assign desk threads", details: {} } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = assignBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: "Validation failed", details: zodErrorDetails(parsed.error) } },
        { status: 400 }
      );
    }

    const result = await assignConversation({
      conversationId: id,
      userId: authResult.user.id,
      assigneeId: parsed.data.assigneeId,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if ([400, 403, 404, 409].includes(error.status)) {
      return NextResponse.json(
        { error: { message: error.message, details: error.details || {} } },
        { status: error.status }
      );
    }
    console.error("PATCH /api/conversations/[id]/assign", error);
    return NextResponse.json({ error: { message: "Unable to assign chat", details: {} } }, { status: 500 });
  }
}
