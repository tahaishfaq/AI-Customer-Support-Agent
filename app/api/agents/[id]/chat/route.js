import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { sendChatMessage } from "@/lib/services/chat.service";
import {
  chatMessageSchema,
  zodErrorDetails,
} from "@/lib/validations/chat";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const { id: agentId } = await params;
    const limited = rateLimit(
      `studio-chat:${authResult.user.id}:${agentId}:${clientIp(request)}`,
      { limit: 40, windowMs: 60_000 }
    );
    if (!limited.ok) {
      return tooManyRequests(
        limited,
        "Too many messages. Try again shortly."
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          error: {
            message: "Validation failed",
            details: { body: "Invalid JSON body" },
          },
        },
        { status: 400 }
      );
    }

    const parsed = chatMessageSchema.safeParse(body);
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

    const result = await sendChatMessage(agentId, authResult.user.id, {
      message: parsed.data.message,
      conversationId: parsed.data.conversationId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (
      error.status === 400 ||
      error.status === 403 ||
      error.status === 404 ||
      error.status === 500 ||
      error.status === 502
    ) {
      return NextResponse.json(
        {
          error: {
            message: error.message,
            details: error.details || {},
          },
        },
        { status: error.status }
      );
    }
    console.error("POST /api/agents/[id]/chat", error);
    return NextResponse.json(
      { error: { message: "Unable to process chat", details: {} } },
      { status: 500 }
    );
  }
}
