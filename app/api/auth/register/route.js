import { registerUser } from "@/lib/services/auth.service";
import { registerSchema, zodErrorDetails } from "@/lib/validations/auth";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { registerLimitOpts } from "@/lib/rate-limit-config";
import { jsonError, jsonOk } from "@/lib/api/error-response";
import { resolveRequestId } from "@/lib/observability/request-id";
import { safeLogError } from "@/lib/observability/safe-log";

export async function POST(request) {
  const requestId = resolveRequestId(request);

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError(request, 400, "Validation failed", {
        body: "Invalid JSON body",
      });
    }
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(
        request,
        400,
        "Validation failed",
        zodErrorDetails(parsed.error)
      );
    }

    // Count only well-formed signup attempts (not invalid-email probes).
    const limited = rateLimit(
      `register:${clientIp(request)}`,
      registerLimitOpts()
    );
    if (!limited.ok) {
      return tooManyRequests(
        limited,
        "Too many accounts created from this network. Try again later.",
        request
      );
    }

    const result = await registerUser(parsed.data);
    return jsonOk(request, result, 201);
  } catch (error) {
    if (error.status === 409) {
      return jsonError(request, 409, error.message);
    }
    if (error.status === 403) {
      return jsonError(request, 403, error.message);
    }
    safeLogError("POST /api/auth/register", {
      requestId,
      route: "register",
      status: 500,
    });
    return jsonError(request, 500, "Unable to register");
  }
}
