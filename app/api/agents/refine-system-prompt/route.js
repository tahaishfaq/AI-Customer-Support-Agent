import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/require-auth";
import { refineSystemPromptDraft } from "@/lib/services/refine-system-prompt.service";
import { zodErrorDetails } from "@/lib/validations/auth";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { MAX_SYSTEM_PROMPT_CHARS } from "@/lib/services/ai/prompt-builder";

const bodySchema = z.object({
  draft: z.string().trim().min(1).max(MAX_SYSTEM_PROMPT_CHARS + 500),
  answerStyle: z.enum(["SHORT", "DETAILED", "HYBRID"]).optional(),
  agentName: z.string().trim().max(120).optional(),
});

export async function POST(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const limited = await rateLimit(
      `refine-prompt:${authResult.user.id}`,
      { limit: 10, windowMs: 60_000 }
    );
    if (!limited.ok) {
      return tooManyRequests(
        limited,
        "Too many prompt refine requests. Try again shortly."
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

    const result = await refineSystemPromptDraft(parsed.data);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (
      error.status === 400 ||
      error.status === 503 ||
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
    console.error("POST /api/agents/refine-system-prompt", error);
    return NextResponse.json(
      { error: { message: "Unable to refine system prompt" } },
      { status: 500 }
    );
  }
}
