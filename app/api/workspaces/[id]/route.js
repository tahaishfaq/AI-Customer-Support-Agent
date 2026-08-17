import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import {
  deleteWorkspaceForUser,
  getWorkspaceForUser,
  updateWorkspaceForUser,
} from "@/lib/services/workspace.service";
import {
  deleteWorkspaceSchema,
  updateWorkspaceSchema,
  zodErrorDetails,
} from "@/lib/validations/workspace";

function workspaceError(error) {
  if (error.status) {
    return NextResponse.json(
      { error: { message: error.message, details: error.details || {} } },
      { status: error.status }
    );
  }
  return null;
}

export async function GET(_request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const { id } = await params;
    const workspace = await getWorkspaceForUser(id, authResult.user.id);
    return NextResponse.json(workspace, { status: 200 });
  } catch (error) {
    const mapped = workspaceError(error);
    if (mapped) return mapped;
    console.error("GET /api/workspaces/[id]", error);
    return NextResponse.json(
      { error: { message: "Unable to load workspace", details: {} } },
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

    const parsed = updateWorkspaceSchema.safeParse(body);
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

    const workspace = await updateWorkspaceForUser(
      id,
      authResult.user.id,
      parsed.data
    );
    return NextResponse.json(workspace, { status: 200 });
  } catch (error) {
    const mapped = workspaceError(error);
    if (mapped) return mapped;
    console.error("PUT /api/workspaces/[id]", error);
    return NextResponse.json(
      { error: { message: "Unable to update workspace", details: {} } },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const { id } = await params;
    let body = {};
    try {
      const text = await request.text();
      if (text) body = JSON.parse(text);
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

    const parsed = deleteWorkspaceSchema.safeParse(body);
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

    const result = await deleteWorkspaceForUser(
      id,
      authResult.user.id,
      parsed.data
    );
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const mapped = workspaceError(error);
    if (mapped) return mapped;
    console.error("DELETE /api/workspaces/[id]", error);
    return NextResponse.json(
      { error: { message: "Unable to delete workspace", details: {} } },
      { status: 500 }
    );
  }
}
