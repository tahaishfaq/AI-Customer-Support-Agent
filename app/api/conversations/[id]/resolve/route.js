import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { resolveConversation } from "@/lib/services/handoff.service";
import {
  resolveBodySchema,
  zodErrorDetails,
} from "@/lib/validations/desk";

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;

    let body = {};
    try {
      const raw = await request.text();
      if (raw.trim()) body = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: { message: "Validation failed", details: { body: "Invalid JSON" } } },
        { status: 400 }
      );
    }

    const parsed = resolveBodySchema.safeParse(body);
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

    const result = await resolveConversation({
      conversationId: id,
      userId: authResult.user.id,
      resumeAi: parsed.data.resumeAi,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return NextResponse.json(
        { error: { message: error.message, details: error.details || {} } },
        { status: error.status }
      );
    }
    console.error("POST /api/conversations/[id]/resolve", error);
    return NextResponse.json(
      { error: { message: "Unable to resolve conversation", details: {} } },
      { status: 500 }
    );
  }
}
