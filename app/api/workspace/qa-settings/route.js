import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import prisma from "@/lib/prisma";
import { resolveActiveWorkspace } from "@/lib/services/workspace.service";
import { normalizeQaSettings } from "@/lib/services/ai/qa-judge";
import { getDeskSettingsForUser } from "@/lib/services/handoff.service";

async function requireQaManager(userId) {
  const deskPayload = await getDeskSettingsForUser(userId);
  if (!deskPayload.desk?.canManage) {
    const err = new Error("Only workspace owners and admins can change QA settings");
    err.status = 403;
    throw err;
  }
  return deskPayload;
}

export async function GET(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    await requireQaManager(authResult.user.id);
    const workspace = await resolveActiveWorkspace(authResult.user.id);
    return NextResponse.json(
      { settings: normalizeQaSettings(workspace.qaSettings) },
      { status: 200 }
    );
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json(
      { error: { message: error.message || "Unable to load QA settings", details: {} } },
      { status: status === 403 || status === 404 ? status : 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    await requireQaManager(authResult.user.id);
    const workspace = await resolveActiveWorkspace(authResult.user.id);
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: { message: "Invalid JSON", details: {} } }, { status: 400 });
    }
    const settings = normalizeQaSettings(body);
    const updated = await prisma.workspace.update({
      where: { id: workspace.id },
      data: { qaSettings: settings },
      select: { qaSettings: true },
    });
    return NextResponse.json(
      { settings: normalizeQaSettings(updated.qaSettings) },
      { status: 200 }
    );
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json(
      { error: { message: error.message || "Unable to save QA settings", details: {} } },
      { status: status === 403 || status === 404 ? status : 500 }
    );
  }
}
