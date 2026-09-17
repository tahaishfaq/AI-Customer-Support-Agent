import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { postAuthPathFromSession } from "@/lib/auth-home";
import { getBillingSnapshot } from "@/lib/billing/subscription.service";
import { getConversationQuota } from "@/lib/billing/conversation-usage.service";
import { needsUserOnboarding } from "@/lib/services/user-onboarding.service";
import { getCachedPublicUser } from "@/lib/services/user-profile-cache";

/** Current NextAuth session user (for clients that prefer REST). */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { message: "Missing or invalid session", details: {} } },
        { status: 401 }
      );
    }

    const profile = await getCachedPublicUser(session.user.id);
    if (!profile) {
      return NextResponse.json(
        { error: { message: "Missing or invalid session", details: {} } },
        { status: 401 }
      );
    }

    const role = profile.role || session.user.role || "USER";
    const billing = await getBillingSnapshot(session.user.id, role);
    const conversations = await getConversationQuota(session.user.id, role, {
      billing,
    });
    const needsOnboarding = await needsUserOnboarding(session.user.id, role);
    const destination = postAuthPathFromSession({
      role,
      billing,
      needsOnboarding,
    });

    return NextResponse.json(
      {
        user: {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role,
          emailVerified: profile.emailVerified || null,
        },
        billing,
        conversations,
        needsOnboarding,
        destination,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/auth/me", error);
    return NextResponse.json(
      { error: { message: "Unable to load user", details: {} } },
      { status: 500 }
    );
  }
}
