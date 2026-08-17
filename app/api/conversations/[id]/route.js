import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { getConversationForUser } from "@/lib/services/conversation.service";

export async function GET(_request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const conversation = await getConversationForUser(id, authResult.user.id);
    return NextResponse.json(conversation, { status: 200 });
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: error.status }
      );
    }
    console.error("GET /api/conversations/[id]", error);
    return NextResponse.json(
      { error: { message: "Unable to load conversation", details: {} } },
      { status: 500 }
    );
  }
}
