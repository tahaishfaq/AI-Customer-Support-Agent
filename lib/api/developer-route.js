import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";

const PASS = new Set([400, 403, 404, 409, 422, 429]);

/**
 * Level 2 · P7 — session-authenticated developer settings routes (webhooks, API keys).
 * Platform admins are refused (workspace settings are the workspace's own).
 */
export async function developerRoute(run, label) {
  try {
    const authResult = await requireAuth();
    if (authResult.error) return authResult.error;
    if (authResult.user.role === "ADMIN") {
      return NextResponse.json({ error: { message: "Platform admin cannot manage workspace developer settings", details: {} } }, { status: 403 });
    }
    const result = await run(authResult.user.id);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (PASS.has(error.status)) {
      return NextResponse.json({ error: { message: error.message, details: error.details || {} } }, { status: error.status });
    }
    console.error(`developer route ${label}`, error?.status || error?.code || error?.message);
    return NextResponse.json({ error: { message: "Something went wrong", details: {} } }, { status: 500 });
  }
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    const err = new Error("Invalid JSON body");
    err.status = 400;
    throw err;
  }
}
