import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { listInboxForUser } from "@/lib/services/handoff.service";
import {
  inboxQuerySchema,
  zodErrorDetails,
} from "@/lib/validations/desk";

export async function GET(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const { searchParams } = new URL(request.url);
    const parsed = inboxQuerySchema.safeParse({
      status: searchParams.get("status") || undefined,
      priority: searchParams.get("priority") || undefined,
      limit: searchParams.get("limit") || undefined,
      offset: searchParams.get("offset") || undefined,
    });

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

    const result = await listInboxForUser(authResult.user.id, parsed.data);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("GET /api/inbox", error);
    return NextResponse.json(
      { error: { message: "Unable to load inbox", details: {} } },
      { status: 500 }
    );
  }
}
