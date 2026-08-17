import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/require-auth";
import { generateAgentTestQuestions } from "@/lib/services/test-questions.service";
import { zodErrorDetails } from "@/lib/validations/auth";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";

const bodySchema = z.object({
  previousPrompts: z.array(z.string().trim().min(1).max(400)).max(24).optional(),
});

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const { id: agentId } = await params;
    const limited = rateLimit(`test-pack:${authResult.user.id}:${agentId}`, {
      limit: 8,
      windowMs: 60_000,
    });
    if (!limited.ok) {
      return tooManyRequests(
        limited,
        "Too many test packs. Try again shortly."
      );
    }

    let body = {};
    try {
      const raw = await request.json();
      body = raw && typeof raw === "object" ? raw : {};
    } catch {
      body = {};
    }

    const parsed = bodySchema.safeParse(body);
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

    const questions = await generateAgentTestQuestions(agentId, authResult.user.id, {
      previousPrompts: parsed.data.previousPrompts || [],
    });

    return NextResponse.json({ questions }, { status: 200 });
  } catch (error) {
    if (
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
    console.error("POST /api/agents/[id]/test-questions", error);
    return NextResponse.json(
      { error: { message: "Unable to generate test questions", details: {} } },
      { status: 500 }
    );
  }
}
