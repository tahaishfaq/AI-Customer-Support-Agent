import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import {
  createPdfKnowledge,
  createTextKnowledge,
  getLatestCrawlJob,
  listKnowledgeForAgent,
} from "@/lib/services/knowledge.service";
import {
  createTextKnowledgeSchema,
  zodErrorDetails,
} from "@/lib/validations/knowledge";

export async function GET(_request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const [documents, latestCrawl] = await Promise.all([
      listKnowledgeForAgent(id, authResult.user.id),
      getLatestCrawlJob(id, authResult.user.id),
    ]);
    return NextResponse.json({ documents, latestCrawl }, { status: 200 });
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: error.status }
      );
    }
    console.error("GET /api/agents/[id]/knowledge", error);
    return NextResponse.json(
      { error: { message: "Unable to list knowledge", details: {} } },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const name = form.get("name");

      const document = await createPdfKnowledge(id, authResult.user.id, {
        file: file instanceof File ? file : null,
        name: typeof name === "string" ? name : undefined,
      });

      return NextResponse.json(document, { status: 201 });
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

    const parsed = createTextKnowledgeSchema.safeParse(body);
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

    const document = await createTextKnowledge(
      id,
      authResult.user.id,
      parsed.data
    );
    return NextResponse.json(document, { status: 201 });
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
    console.error("POST /api/agents/[id]/knowledge", error);
    return NextResponse.json(
      { error: { message: "Unable to add knowledge", details: {} } },
      { status: 500 }
    );
  }
}
