import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import {
  getDeskCannedReplies,
  saveDeskCannedReplies,
} from "@/lib/services/handoff.service";
import { cannedRepliesBodySchema, zodErrorDetails } from "@/lib/validations/desk";

export async function GET(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    const result = await getDeskCannedReplies(authResult.user.id);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("GET /api/desk/canned-replies", error);
    return NextResponse.json(
      { error: { message: "Unable to load canned replies", details: {} } },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    if (authResult.user.role === "ADMIN") {
      return NextResponse.json(
        { error: { message: "Platform admin cannot edit canned replies", details: {} } },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const parsed = cannedRepliesBodySchema.safeParse(body);
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

    const result = await saveDeskCannedReplies(
      authResult.user.id,
      parsed.data.replies
    );
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("PUT /api/desk/canned-replies", error);
    return NextResponse.json(
      { error: { message: "Unable to save canned replies", details: {} } },
      { status: 500 }
    );
  }
}
