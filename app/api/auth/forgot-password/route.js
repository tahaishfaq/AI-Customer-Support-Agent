import { z } from "zod";
import { jsonError, jsonOk } from "@/lib/api/error-response";
import { resolveRequestId } from "@/lib/observability/request-id";
import { safeLogError } from "@/lib/observability/safe-log";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { forgotPasswordLimitOpts } from "@/lib/rate-limit-config";
import { requestPasswordResetOtp } from "@/lib/services/password-reset.service";

const schema = z.object({
  email: z.string().trim().email().max(254),
});

export async function POST(request) {
  const requestId = resolveRequestId(request);
  try {
    const limited = rateLimit(
      `forgot-password:${clientIp(request)}`,
      forgotPasswordLimitOpts()
    );
    if (!limited.ok) {
      return tooManyRequests(
        limited,
        "Too many reset requests. Try again later.",
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
      // Still generic — avoid email-format probes leaking differently than success.
      return jsonOk(request, { ok: true });
    }

    const emailLimited = rateLimit(
      `forgot-password-email:${parsed.data.email.toLowerCase()}`,
      forgotPasswordLimitOpts()
    );
    if (!emailLimited.ok) {
      return tooManyRequests(
        emailLimited,
        "Too many reset requests. Try again later.",
        request
      );
    }

    await requestPasswordResetOtp(parsed.data.email);
    return jsonOk(request, { ok: true });
  } catch (error) {
    if (error.status === 503 || error.code === "EMAIL_NOT_CONFIGURED") {
      return jsonError(request, 503, "Email service unavailable");
    }
    safeLogError("POST /api/auth/forgot-password", {
      requestId,
      route: "forgot-password",
      status: 500,
    });
    return jsonError(request, 500, "Unable to process request");
  }
}
