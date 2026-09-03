import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/layout/AppShell";
import { MaintenanceScreen } from "@/components/layout/MaintenanceScreen";
import { getAppAccessGate } from "@/lib/app-access-gate";
import { redirectForSessionUser } from "@/lib/auth-session-guard";

export default async function AppLayout({ children }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const gate = await getAppAccessGate(
    session.user.id,
    session.user.role || "USER"
  );
  redirectForSessionUser(gate.row);

  if (gate.row?.role !== "ADMIN") {
    if (gate.maintenanceMode) {
      return <MaintenanceScreen />;
    }
    if (gate.needsOnboarding) {
      redirect("/billing/onboarding");
    }
    if (!gate.billingUnlocked) {
      redirect("/billing/plans");
    }
  }

  return <AppShell>{children}</AppShell>;
}
