import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { listConversationsForUser } from "@/lib/services/conversation.service";
import {
  listConversationsQuerySchema,
  zodErrorDetails,
} from "@/lib/validations/chat";

export async function GET(request) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const { searchParams } = new URL(request.url);
    const parsed = listConversationsQuerySchema.safeParse({
      agentId: searchParams.get("agentId") || undefined,
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
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

    const result = await listConversationsForUser(
      authResult.user.id,
      parsed.data
    );
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: error.status }
      );
    }
    console.error("GET /api/conversations", error);
    return NextResponse.json(
      { error: { message: "Unable to list conversations", details: {} } },
      { status: 500 }
    );
  }
}
