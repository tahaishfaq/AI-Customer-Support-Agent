import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/services/api-key.service";
import { rateLimit } from "@/lib/rate-limit";

const PASS = new Set([400, 401, 403, 404]);
const RATE = { limit: 120, windowMs: 60_000 };

/**
 * Level 2 · P7 — REST API v1 handler: API key → workspace, per-key rate limit, read-only.
 * Errors are `{ error: { code, message } }`; nothing internal leaks.
 */
export async function v1Route(request, run, label) {
  try {
    const auth = await authenticateApiKey(request.headers.get("authorization"));
    if (!auth.scopes.includes("read")) {
      return NextResponse.json({ error: { code: "SCOPE_REQUIRED", message: "This key cannot read" } }, { status: 403 });
    }
    const limited = await rateLimit(`api-v1:${auth.keyId}`, RATE);
    if (!limited.ok) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests" } },
        { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } }
      );
    }
    const query = Object.fromEntries(new URL(request.url).searchParams.entries());
    return NextResponse.json(await run(auth.workspaceId, query), { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (PASS.has(error.status)) {
      const code = error.details?.code || { 400: "BAD_REQUEST", 401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND" }[error.status];
      return NextResponse.json({ error: { code, message: error.message } }, { status: error.status });
    }
    console.error(`GET /api/v1 ${label}`, error?.status || error?.code || error?.message);
    return NextResponse.json({ error: { code: "INTERNAL", message: "Something went wrong" } }, { status: 500 });
  }
}
