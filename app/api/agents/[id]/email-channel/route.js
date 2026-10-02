import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { setAgentEmailChannel } from "@/lib/services/email-inbound.service";

/** Owner configures inbound email address for this agent. */
export async function PUT(request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const { id } = await params;
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { message: "Validation failed", details: { body: "Invalid JSON" } } },
        { status: 400 }
      );
    }

    const agent = await setAgentEmailChannel(id, authResult.user.id, {
      enabled: body.enabled !== false,
      address: body.address,
      fromName: body.fromName,
    });

    return NextResponse.json(
      {
        id: agent.id,
        emailChannelAddress: agent.emailChannelAddress,
        emailChannel: agent.emailChannel,
      },
      { status: 200 }
    );
  } catch (error) {
    if (
      error.status === 400 ||
      error.status === 403 ||
      error.status === 404 ||
      error.status === 409
    ) {
      return NextResponse.json(
        {
          error: {
            message: error.message,
            details: { code: error.code || null },
          },
        },
        { status: error.status }
      );
    }
    console.error("PUT /api/agents/[id]/email-channel", error);
    return NextResponse.json(
      { error: { message: "Unable to update email channel" } },
      { status: 500 }
    );
  }
}
