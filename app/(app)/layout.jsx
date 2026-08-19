import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { AppShell } from "@/components/layout/AppShell";
import { MaintenanceScreen } from "@/components/layout/MaintenanceScreen";
import { getPlatformSettings } from "@/lib/services/platform-settings.service";

export default async function AppLayout({ children }) {
  const session = await auth();
  if (session?.user?.id) {
    const row = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { status: true, role: true },
    });
    if (!row || row.status === "SUSPENDED") {
      redirect("/login?suspended=1");
    }
    if (row.role !== "ADMIN") {
      const settings = await getPlatformSettings();
      if (settings.maintenanceMode) {
        return <MaintenanceScreen />;
      }
    }
  }

  return <AppShell>{children}</AppShell>;
}
