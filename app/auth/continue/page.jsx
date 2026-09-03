import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAppAccessGate } from "@/lib/app-access-gate";
import { postAuthPathFromSession } from "@/lib/auth-home";
import { redirectForSessionUser } from "@/lib/auth-session-guard";

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

  redirect(dest);
}
