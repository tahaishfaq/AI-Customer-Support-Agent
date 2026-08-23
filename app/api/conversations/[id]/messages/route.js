import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { sendHumanReply } from "@/lib/services/handoff.service";
import {
  humanMessageBodySchema,
  zodErrorDetails,
} from "@/lib/validations/desk";

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    if (authResult.user.role === "ADMIN") {
      return NextResponse.json(
        {
          error: {
            message: "Platform admin cannot send human desk replies",
            details: {},
          },
        },
        { status: 403 }
      );
    }

    const { id } = await params;

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { message: "Validation failed", details: { body: "Invalid JSON" } } },
        { status: 400 }
      );
    }

    const parsed = humanMessageBodySchema.safeParse(body);
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

    const result = await sendHumanReply({
      conversationId: id,
      userId: authResult.user.id,
      message: parsed.data.message,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error.status === 403 || error.status === 404 || error.status === 409) {
      return NextResponse.json(
        { error: { message: error.message, details: error.details || {} } },
        { status: error.status }
      );
    }
    console.error("POST /api/conversations/[id]/messages", error);
    return NextResponse.json(
      { error: { message: "Unable to send reply", details: {} } },
      { status: 500 }
    );
  }
}
