import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { sendInternalNote } from "@/lib/services/handoff.service";
import {
  internalNoteBodySchema,
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
            message: "Platform admin cannot add desk internal notes",
            details: {},
          },
        },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = internalNoteBodySchema.safeParse(body);
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

    const result = await sendInternalNote({
      conversationId: id,
      userId: authResult.user.id,
      message: parsed.data.message,
    });

    return NextResponse.json(result, { status: 201 });
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
    console.error("POST /api/conversations/[id]/notes", error);
    return NextResponse.json(
      { error: { message: "Unable to save note", details: {} } },
      { status: 500 }
    );
  }
}
