import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api/error-response";
import { resolveRequestId } from "@/lib/observability/request-id";
import { safeLogError } from "@/lib/observability/safe-log";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { verifyEmailLimitOpts } from "@/lib/rate-limit-config";
import { verifyEmailWithToken } from "@/lib/services/email-lifecycle.service";

const schema = z.object({
  token: z.string().trim().min(16).max(256),
});

export async function POST(request) {
  const requestId = resolveRequestId(request);
  try {
    const limited = rateLimit(
      `verify-email:${clientIp(request)}`,
      verifyEmailLimitOpts()
    );
    if (!limited.ok) {
      return tooManyRequests(
        limited,
        "Too many attempts. Try again later.",
        request
      );
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return jsonError(request, 400, "Invalid verification link");
    }

    await verifyEmailWithToken(parsed.data.token);
    return jsonOk(request, { ok: true });
  } catch (error) {
    if (error.status === 400) {
      return jsonError(request, 400, error.message);
    }
    safeLogError("POST /api/auth/verify-email", {
      requestId,
      route: "verify-email",
      status: 500,
    });
    return jsonError(request, 500, "Unable to verify email");
  }
}
