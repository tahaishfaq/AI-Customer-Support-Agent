import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api/error-response";
import { auth } from "@/auth";
import { resolveRequestId } from "@/lib/observability/request-id";
import { safeLogError } from "@/lib/observability/safe-log";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { resendVerifyLimitOpts } from "@/lib/rate-limit-config";
import { resendVerifyEmail } from "@/lib/services/email-lifecycle.service";

const schema = z.object({
  email: z.string().trim().email().max(254).optional(),
});

export async function POST(request) {
  const requestId = resolveRequestId(request);
  try {
    const limited = rateLimit(
      `resend-verify:${clientIp(request)}`,
      resendVerifyLimitOpts()
    );
    if (!limited.ok) {
      return tooManyRequests(
        limited,
        "Too many requests. Try again later.",
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
    const session = await auth();
    const email =
      parsed.success && parsed.data.email
        ? parsed.data.email
        : session?.user?.email || "";

    if (!email) {
      return jsonOk(request, { ok: true });
    }

    const emailLimited = rateLimit(
      `resend-verify-email:${String(email).toLowerCase()}`,
      resendVerifyLimitOpts()
    );
    if (!emailLimited.ok) {
      return tooManyRequests(
        emailLimited,
        "Too many requests. Try again later.",
        request
      );
    }

    await resendVerifyEmail(email);
    return jsonOk(request, { ok: true });
  } catch (error) {
    safeLogError("POST /api/auth/resend-verify", {
      requestId,
      route: "resend-verify",
      status: 500,
    });
    return jsonError(request, 500, "Unable to resend verification");
  }
}
