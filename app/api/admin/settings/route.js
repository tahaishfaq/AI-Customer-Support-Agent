import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import {
  getPlatformSettings,
  updatePlatformSettings,
} from "@/lib/services/platform-settings.service";
import { writeAuditEvent } from "@/lib/services/audit.service";
import { clientIp } from "@/lib/rate-limit";

export async function GET() {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;
    const settings = await getPlatformSettings();
    return NextResponse.json({ settings }, { status: 200 });
  } catch (error) {
    console.error("GET /api/admin/settings", error);
    return NextResponse.json(
      { error: { message: "Unable to load settings", details: {} } },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const authResult = await requireAdmin();
    if (authResult.error) return authResult.error;

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const { settings, previous } = await updatePlatformSettings(body);
    await writeAuditEvent({
      adminId: authResult.user.id,
      action: "SETTINGS_UPDATE",
      targetType: "platform",
      targetId: "global",
      metadata: { previous, next: settings },
      ip: clientIp(request),
    });
    return NextResponse.json({ settings }, { status: 200 });
  } catch (error) {
    if (error.status === 400) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: 400 }
      );
    }
    console.error("PUT /api/admin/settings", error);
    return NextResponse.json(
      { error: { message: "Unable to save settings", details: {} } },
      { status: 500 }
    );
  }
}
