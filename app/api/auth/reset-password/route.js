import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api/error-response";
import { resolveRequestId } from "@/lib/observability/request-id";
import { safeLogError } from "@/lib/observability/safe-log";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { resetPasswordLimitOpts } from "@/lib/rate-limit-config";
import { resetPasswordWithOtp } from "@/lib/services/password-reset.service";

const schema = z.object({
  email: z.string().trim().email().max(254),
  code: z.string().trim().regex(/^\d{6}$/),
  newPassword: z.string().min(8).max(200),
});

export async function POST(request) {
  const requestId = resolveRequestId(request);
  try {
    const limitedIp = rateLimit(
      `reset-password:${clientIp(request)}`,
      resetPasswordLimitOpts()
    );
    if (!limitedIp.ok) {
      return tooManyRequests(
        limitedIp,
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
      return jsonError(request, 400, "Invalid reset request");
    }

    const limitedEmail = rateLimit(
      `reset-password-email:${parsed.data.email.toLowerCase()}`,
      resetPasswordLimitOpts()
    );
    if (!limitedEmail.ok) {
      return tooManyRequests(
        limitedEmail,
        "Too many attempts. Try again later.",
        request
      );
    }

    await resetPasswordWithOtp(parsed.data);
    return jsonOk(request, { ok: true });
  } catch (error) {
    if (error.status === 400) {
      return jsonError(request, 400, error.message);
    }
    safeLogError("POST /api/auth/reset-password", {
      requestId,
      route: "reset-password",
      status: 500,
    });
    return jsonError(request, 500, "Unable to reset password");
  }
}
