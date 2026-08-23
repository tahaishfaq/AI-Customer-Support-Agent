import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { triggerHandoff } from "@/lib/services/handoff.service";
import {
  handoffBodySchema,
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

    const parsed = handoffBodySchema.safeParse(body);
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

    const result = await triggerHandoff({
      conversationId: id,
      userId: authResult.user.id,
      reason: parsed.data.reason,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error.status === 404 || error.status === 409 || error.status === 429) {
      return NextResponse.json(
        { error: { message: error.message, details: error.details || {} } },
        { status: error.status }
      );
    }
    console.error("POST /api/conversations/[id]/handoff", error);
    return NextResponse.json(
      { error: { message: "Unable to trigger handoff", details: {} } },
      { status: 500 }
    );
  }
}
