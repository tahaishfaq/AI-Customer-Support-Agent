import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAppAccessGate } from "@/lib/app-access-gate";
import { postAuthPathFromSession, isProductAppPath } from "@/lib/auth-home";
import { redirectForSessionUser } from "@/lib/auth-session-guard";
import { resolveActiveWorkspace } from "@/lib/services/workspace.service";
import { withWorkspaceSlug } from "@/lib/workspace-path";
import { isEmailVerificationRequired } from "@/lib/email/constants";
import prisma from "@/lib/prisma";

/**
 * Post-login hop: one gate query → correct destination.
 * Avoids landing on /dashboard (and its APIs) before onboarding/plans.
 */
export default async function AuthContinuePage({ searchParams }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const role = session.user.role || "USER";
  if (role === "ADMIN") {
    redirect("/admin");
  }

  const gate = await getAppAccessGate(session.user.id, role);
  redirectForSessionUser(gate.row);

  const params = await searchParams;
  // Misrouted verify links land here with ?token= (proxy used to rewrite
  // /verify-email → /auth/continue while preserving the query).
  if (typeof params?.token === "string" && params.token.trim()) {
    redirect(`/verify-email?token=${encodeURIComponent(params.token.trim())}`);
  }
  const nextPath =
    typeof params?.next === "string" && params.next.startsWith("/")
      ? params.next
      : "";

  const dest = postAuthPathFromSession({
    role: gate.row?.role || role,
    billing: { unlocked: gate.billingUnlocked },
    needsOnboarding: gate.needsOnboarding,
    nextPath,
  });

  // Soft by default; hard gate only when EMAIL_VERIFICATION_REQUIRED=1.
  // Onboarding + plans still allowed; product paths wait for verify.
  if (isEmailVerificationRequired() && isProductAppPath(dest)) {
    const row = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { emailVerified: true },
    });
    if (!row?.emailVerified) {
      redirect("/verify-email");
    }
  }

  if (isProductAppPath(dest)) {
    // RSC page cannot set cookies; API routes persist the active workspace later.
    const workspace = await resolveActiveWorkspace(session.user.id, {
      persistCookie: false,
    });
    redirect(withWorkspaceSlug(dest, workspace.slug));
  }

  redirect(dest);
}
