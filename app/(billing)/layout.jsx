import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getCachedPublicUser } from "@/lib/services/user-profile-cache";
import { redirectForSessionUser } from "@/lib/auth-session-guard";

export default async function BillingLayout({ children }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?next=/billing/plans");
  }

  const row = await getCachedPublicUser(session.user.id);
  redirectForSessionUser(
    row ? { status: row.status, role: row.role } : null
  );

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {children}
    </div>
  );
}
