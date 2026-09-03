import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import {
  completeUserOnboarding,
  getUserOnboarding,
} from "@/lib/services/user-onboarding.service";
import {
  onboardingInterestSchema,
  zodErrorDetails,
} from "@/lib/validations/onboarding";

export async function GET(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    const onboarding = await getUserOnboarding(authResult.user.id);
    return NextResponse.json({ onboarding }, { status: 200 });
  } catch (error) {
    console.error("GET /api/onboarding", error);
    return NextResponse.json(
      { error: { message: "Unable to load onboarding", details: {} } },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const authResult = await requireAuth(request);
    if (authResult.error) return authResult.error;

    let body = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const parsed = onboardingInterestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            message: "Invalid onboarding",
            details: zodErrorDetails(parsed.error),
          },
        },
        { status: 400 }
      );
    }

    const onboarding = await completeUserOnboarding(
      authResult.user.id,
      parsed.data,
      {
        userName: authResult.user.name,
      }
    );

    return NextResponse.json(
      {
        ok: true,
        onboarding,
        redirectTo: "/billing/plans",
      },
      { status: 200 }
    );
  } catch (error) {
    if (error.status === 400 || error.status === 422) {
      return NextResponse.json(
        { error: { message: error.message, details: {} } },
        { status: error.status }
      );
    }
    console.error("POST /api/onboarding", error);
    return NextResponse.json(
      { error: { message: "Unable to save onboarding", details: {} } },
      { status: 500 }
    );
  }
}
