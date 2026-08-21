import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import prisma from "@/lib/prisma";
import { setMessageFeedback } from "@/lib/services/feedback.service";

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const rating = body.rating === "DOWN" ? "DOWN" : "UP";

    const owned = await prisma.message.findFirst({
      where: {
        id,
        conversation: { agent: { userId: authResult.user.id } },
      },
      select: { id: true, conversation: { select: { agentId: true } } },
    });
    if (!owned) {
      return NextResponse.json(
        { error: { message: "Message not found", details: {} } },
        { status: 404 }
      );
    }

    const result = await setMessageFeedback(id, rating, {
      agentId: owned.conversation.agentId,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error.status) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: error.status }
      );
    }
    console.error("POST /api/messages/[id]/feedback", error);
    return NextResponse.json(
      { error: { message: "Unable to save feedback", details: {} } },
      { status: 500 }
    );
  }
}
