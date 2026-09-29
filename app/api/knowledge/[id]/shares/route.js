import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import {
  listDocumentShares,
  setDocumentShares,
} from "@/lib/services/knowledge.service";
import { z } from "zod";
import { zodErrorDetails } from "@/lib/validations/auth";

const putSchema = z.object({
  consumerAgentIds: z.array(z.string().trim().min(1)).max(50),
});

export async function GET(_request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const data = await listDocumentShares(id, authResult.user.id);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    if (error.status === 403 || error.status === 404) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: error.status }
      );
    }
    console.error("GET /api/knowledge/[id]/shares", error);
    return NextResponse.json(
      { error: { message: "Unable to list document shares", details: {} } },
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

    const parsed = putSchema.safeParse(body);
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

    const data = await setDocumentShares(
      id,
      authResult.user.id,
      parsed.data.consumerAgentIds
    );
    return NextResponse.json(data, { status: 200 });
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
            details: error.details || {},
          },
        },
        { status: error.status }
      );
    }
    console.error("PUT /api/knowledge/[id]/shares", error);
    return NextResponse.json(
      { error: { message: "Unable to update document shares", details: {} } },
      { status: 500 }
    );
  }
}
