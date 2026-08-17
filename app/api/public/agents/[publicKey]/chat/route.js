import { NextResponse } from "next/server";
import { sendChatMessage } from "@/lib/services/chat.service";
import { getPublicAgentByKey } from "@/lib/services/embed.service";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { chatMessageSchema, zodErrorDetails } from "@/lib/validations/chat";

export async function POST(request, { params }) {
  try {
    const { publicKey } = await params;
    const ip = clientIp(request);
    const limited = rateLimit(`pub-chat:${publicKey}:${ip}`, {
      limit: 20,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return NextResponse.json(
        { error: { message: "Too many messages. Try again shortly.", details: {} } },
        {
          status: 429,
          headers: { "Retry-After": String(limited.retryAfterSec) },
        }
      );
    }

    const agent = await getPublicAgentByKey(publicKey);
    if (!agent) {
      return NextResponse.json(
        { error: { message: "Agent not found", details: {} } },
        { status: 404 }
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

    const result = await sendChatMessage(agent.id, {
      publicAccess: true,
      message: parsed.data.message,
      conversationId: parsed.data.conversationId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error.status === 400 || error.status === 403 || error.status === 404 || error.status === 502) {
      return NextResponse.json(
        { error: { message: error.message, details: error.details || {} } },
        { status: error.status }
      );
    }
    console.error("POST /api/public/agents/[publicKey]/chat", error);
    return NextResponse.json(
      { error: { message: "Unable to process chat", details: {} } },
      { status: 500 }
    );
  }
}
