import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/layout/AppShell";
import { MaintenanceScreen } from "@/components/layout/MaintenanceScreen";
import { getAppAccessGate } from "@/lib/app-access-gate";
import { redirectForSessionUser } from "@/lib/auth-session-guard";
import {
  logAuthTiming,
  startAuthTiming,
} from "@/lib/observability/auth-timing";

export default async function AppLayout({ children }) {
  const startedAt = startAuthTiming();
  const session = await auth();
  logAuthTiming("app_layout.auth", startedAt, { route: "(app)" });
  if (!session?.user?.id) {
    redirect("/login");
  }

  const gateStartedAt = startAuthTiming();
  const gate = await getAppAccessGate(
    session.user.id,
    session.user.role || "USER"
  );
  logAuthTiming("app_layout.access_gate", gateStartedAt, { route: "(app)" });
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
