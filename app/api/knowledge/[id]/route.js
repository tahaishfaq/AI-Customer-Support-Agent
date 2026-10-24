import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import {
  deleteKnowledgeForUser,
  updateTextKnowledgeForUser,
} from "@/lib/services/knowledge.service";
import {
  updateTextKnowledgeSchema,
  zodErrorDetails,
} from "@/lib/validations/knowledge";

export async function PATCH(request, { params }) {
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

    const parsed = updateTextKnowledgeSchema.safeParse(body);
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

    const document = await updateTextKnowledgeForUser(
      id,
      authResult.user.id,
      parsed.data
    );
    return NextResponse.json(document, { status: 200 });
  } catch (error) {
    if (
      error.status === 400 ||
      error.status === 403 ||
      error.status === 404
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
    console.error("PATCH /api/knowledge/[id]", error);
    return NextResponse.json(
      { error: { message: "Unable to update knowledge", details: {} } },
      { status: 500 }
    );
  }
}

export async function DELETE(_request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const { id } = await params;
    await deleteKnowledgeForUser(id, authResult.user.id);
    return new NextResponse(null, { status: 204 });
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
    console.error("DELETE /api/knowledge/[id]", error);
    return NextResponse.json(
      { error: { message: "Unable to delete knowledge", details: {} } },
      { status: 500 }
    );
  }
}
