import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import prisma from "@/lib/prisma";
import { resolveActiveWorkspace } from "@/lib/services/workspace.service";
import { normalizePrivacy } from "@/lib/privacy/redaction";
import { getDeskSettingsForUser } from "@/lib/services/handoff.service";
import { previewRetentionCount } from "@/lib/services/privacy.service";
import { writeAuditEvent } from "@/lib/services/audit.service";

async function requirePrivacyManager(userId) {
  const deskPayload = await getDeskSettingsForUser(userId);
  if (!deskPayload.desk?.canManage) {
    const err = new Error("Only workspace owners and admins can change privacy settings");
    err.status = 403;
    throw err;
  }
  return deskPayload;
}

export async function GET(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    await requirePrivacyManager(authResult.user.id);
    const workspace = await resolveActiveWorkspace(authResult.user.id);
    const settings = normalizePrivacy(workspace.privacy);
    const previewCount = await previewRetentionCount(workspace.id, settings.retentionDays);
    return NextResponse.json({ settings, previewCount }, { status: 200 });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json(
      { error: { message: error.message || "Unable to load privacy settings", details: {} } },
      { status: status === 403 || status === 404 ? status : 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;
    await requirePrivacyManager(authResult.user.id);
    const workspace = await resolveActiveWorkspace(authResult.user.id);
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: { message: "Invalid JSON", details: {} } }, { status: 400 });
    }

    const next = normalizePrivacy(body);
    const prev = normalizePrivacy(workspace.privacy);
    if (
      next.retentionDays != null &&
      prev.retentionDays != null &&
      next.retentionDays < prev.retentionDays &&
      body?.confirmLowerRetention !== "LOWER RETENTION"
    ) {
      return NextResponse.json(
        {
          error: {
            message: "Type LOWER RETENTION to shorten retention",
            details: { code: "confirm_required" },
          },
        },
        { status: 400 }
      );
    }

    const updated = await prisma.workspace.update({
      where: { id: workspace.id },
      data: { privacy: next },
      select: { privacy: true },
    });
    await writeAuditEvent({
      adminId: authResult.user.id,
      action: "privacy.retention",
      targetType: "workspace",
      targetId: workspace.id,
      metadata: { retentionDays: next.retentionDays, redactPii: next.redactPii },
    }).catch(() => {});

    const settings = normalizePrivacy(updated.privacy);
    const previewCount = await previewRetentionCount(workspace.id, settings.retentionDays);
    return NextResponse.json({ settings, previewCount }, { status: 200 });
  } catch (error) {
    const status = error.status || 500;
    return NextResponse.json(
      { error: { message: error.message || "Unable to save privacy settings", details: {} } },
      { status: status === 403 || status === 404 ? status : 500 }
    );
  }
}
