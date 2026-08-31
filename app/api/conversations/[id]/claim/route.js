import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { claimConversation } from "@/lib/services/handoff.service";
import { claimBodySchema, zodErrorDetails } from "@/lib/validations/desk";

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    if (authResult.user.role === "ADMIN") {
      return NextResponse.json(
        { error: { message: "Platform admin cannot claim desk threads", details: {} } },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = claimBodySchema.safeParse(body);
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

    const result = await claimConversation({
      conversationId: id,
      userId: authResult.user.id,
      claim: parsed.data.claim,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error.status === 403 || error.status === 404 || error.status === 409) {
      return NextResponse.json(
        { error: { message: error.message, details: error.details || {} } },
        { status: error.status }
      );
    }
    console.error("POST /api/conversations/[id]/claim", error);
    return NextResponse.json(
      { error: { message: "Unable to update claim", details: {} } },
      { status: 500 }
    );
  }
}
