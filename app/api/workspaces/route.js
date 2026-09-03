import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { requireProductAccess } from "@/lib/require-product";
import {
  createWorkspaceForUser,
  listWorkspacesForUser,
} from "@/lib/services/workspace.service";
import {
  createWorkspaceSchema,
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

export async function GET() {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;

    const result = await listWorkspacesForUser(authResult.user.id);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const mapped = workspaceError(error);
    if (mapped) return mapped;
    console.error("GET /api/workspaces", error);
    return NextResponse.json(
      { error: { message: "Unable to list workspaces", details: {} } },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const authResult = await requireProductAccess(request);
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

    const parsed = createWorkspaceSchema.safeParse(body);
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

    const workspace = await createWorkspaceForUser(
      authResult.user.id,
      parsed.data,
      { role: authResult.user.role }
    );
    return NextResponse.json(workspace, { status: 201 });
  } catch (error) {
    const mapped = workspaceError(error);
    if (mapped) return mapped;
    console.error("POST /api/workspaces", error);
    return NextResponse.json(
      { error: { message: "Unable to create workspace", details: {} } },
      { status: 500 }
    );
  }
}
