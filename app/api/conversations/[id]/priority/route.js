import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { setHandoffPriority } from "@/lib/services/handoff.service";
import { deskPriorityBodySchema, zodErrorDetails } from "@/lib/validations/desk";

export async function PATCH(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    if (authResult.user.role === "ADMIN") {
      return NextResponse.json(
        { error: { message: "Platform admin cannot set desk priority", details: {} } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = deskPriorityBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: "Validation failed",
            details: zodErrorDetails(parsed.error),
          },
        },
        { status: 400 }
      );
    }

    const result = await setHandoffPriority({
      conversationId: id,
      userId: authResult.user.id,
      priority: parsed.data.priority,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (
      error.status === 400 ||
      error.status === 403 ||
      error.status === 404 ||
      error.status === 409
    ) {
      return NextResponse.json(
        { error: { message: error.message, details: error.details || {} } },
        { status: error.status }
      );
    }
    console.error("PATCH /api/conversations/[id]/priority", error);
    return NextResponse.json(
      { error: { message: "Unable to set priority", details: {} } },
      { status: 500 }
    );
  }
}
