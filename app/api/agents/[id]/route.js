import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import {
  deleteAgentForUser,
  getAgentForUser,
  updateAgentForUser,
} from "@/lib/services/agent.service";
import { resolveWhiteLabelAccess } from "@/lib/billing/entitlements.service";
import {
  updateAgentSchema,
  zodErrorDetails,
} from "@/lib/validations/agent";

export async function GET(_request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const agent = await getAgentForUser(id, authResult.user.id);
    const whiteLabelAllowed = await resolveWhiteLabelAccess(agent.userId);
    return NextResponse.json({ ...agent, whiteLabelAllowed }, { status: 200 });
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: error.status }
      );
    }
    console.error("GET /api/agents/[id]", error);
    return NextResponse.json(
      { error: { message: "Unable to load agent", details: {} } },
      { status: 500 }
    );
  }
}

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
        {
          error: {
            message: "Validation failed",
            details: { body: "Invalid JSON body" },
          },
        },
        { status: 400 }
      );
    }

    const parsed = updateAgentSchema.safeParse(body);
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

    const agent = await updateAgentForUser(
      id,
      authResult.user.id,
      parsed.data
    );
    return NextResponse.json(agent, { status: 200 });
  } catch (error) {
    if (error.status === 402 && error.code === "plan_feature_required") {
      return NextResponse.json(
        { error: { message: error.message, details: error.details } },
        { status: 402 }
      );
    }
    if (error.status === 403 || error.status === 404) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: error.status }
      );
    }
    console.error("PUT /api/agents/[id]", error);
    return NextResponse.json(
      { error: { message: "Unable to update agent", details: {} } },
      { status: 500 }
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const { id } = await params;
    await deleteAgentForUser(id, authResult.user.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: error.status }
      );
    }
    console.error("DELETE /api/agents/[id]", error);
    return NextResponse.json(
      { error: { message: "Unable to delete agent", details: {} } },
      { status: 500 }
    );
  }
}
