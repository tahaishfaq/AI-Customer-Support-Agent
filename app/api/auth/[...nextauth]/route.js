import { handlers } from "@/auth";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const GET = handlers.GET;

export async function POST(request, context) {
  const limited = rateLimit(`auth-post:${clientIp(request)}`, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return tooManyRequests(
      limited,
      "Too many sign-in attempts. Try again shortly."
    );
  }
  return handlers.POST(request, context);
}
