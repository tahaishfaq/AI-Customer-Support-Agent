import { NextResponse } from "next/server";
import { getPublicAgentByKey } from "@/lib/services/embed.service";
import { mergeCustomization } from "@/lib/customization/defaults";
import { setMessageFeedback } from "@/lib/services/feedback.service";

export async function POST(request, { params }) {
  try {
    const { publicKey } = await params;
    const agent = await getPublicAgentByKey(publicKey);
    if (!agent) {
      return NextResponse.json(
        { error: { message: "Agent not found", details: {} } },
        { status: 404 }
      );
    }
    if (!mergeCustomization(agent.customization).features.messageFeedback) {
      return NextResponse.json(
        { error: { message: "Feedback is disabled for this agent", details: {} } },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const messageId = String(body.messageId || "");
    const rating = body.rating === "DOWN" ? "DOWN" : "UP";
    if (!messageId) {
      return NextResponse.json(
        {
          error: {
            message: "Validation failed",
            details: { messageId: "Required" },
          },
        },
        { status: 400 }
      );
    }

    const result = await setMessageFeedback(messageId, rating, {
      agentId: agent.id,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error.status) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: error.status }
      );
    }
    console.error("POST /api/public/agents/[publicKey]/feedback", error);
    return NextResponse.json(
      { error: { message: "Unable to save feedback", details: {} } },
      { status: 500 }
    );
  }
}
