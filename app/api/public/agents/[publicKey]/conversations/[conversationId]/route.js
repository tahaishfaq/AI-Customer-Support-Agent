import { NextResponse } from "next/server";
import { getPublicAgentByKey } from "@/lib/services/embed.service";
import prisma from "@/lib/prisma";

export async function GET(request, { params }) {
  try {
    const { publicKey, conversationId } = await params;
    const agent = await getPublicAgentByKey(publicKey);
    if (!agent) {
      return NextResponse.json(
        { error: { message: "Agent not found", details: {} } },
        { status: 404 }
      );
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            content: true,
            responseTime: true,
            feedback: true,
            createdAt: true,
          },
        },
      },
    });

    if (!conversation || conversation.agentId !== agent.id) {
      return NextResponse.json(
        { error: { message: "Conversation not found", details: {} } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: conversation.id,
      messages: conversation.messages,
    });
  } catch (error) {
    console.error("GET public conversation", error);
    return NextResponse.json(
      { error: { message: "Unable to load conversation", details: {} } },
      { status: 500 }
    );
  }
}
