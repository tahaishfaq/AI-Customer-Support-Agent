import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import {
  createAgentForUser,
  listAgentsForUser,
} from "@/lib/services/agent.service";
import {
  createAgentSchema,
  zodErrorDetails,
} from "@/lib/validations/agent";

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const agents = await listAgentsForUser(authResult.user.id);
    return NextResponse.json({ agents }, { status: 200 });
  } catch (error) {
    console.error("GET /api/agents", error);
    return NextResponse.json(
      { error: { message: "Unable to list agents", details: {} } },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

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

    const parsed = createAgentSchema.safeParse(body);
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

    const agent = await createAgentForUser(authResult.user.id, parsed.data);
    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    console.error("POST /api/agents", error);
    return NextResponse.json(
      { error: { message: "Unable to create agent", details: {} } },
      { status: 500 }
    );
  }
}
