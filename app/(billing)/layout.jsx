import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { isBillingUnlocked } from "@/lib/billing/access";
import { redirectForSessionUser } from "@/lib/auth-session-guard";

export default async function BillingLayout({ children }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?next=/billing/plans");
  }

  const row = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { status: true, role: true },
  });

  redirectForSessionUser(row);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {children}
    </div>
  );
}
