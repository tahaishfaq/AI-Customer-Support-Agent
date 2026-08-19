import { auth } from "@/auth";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function AdminConsoleLayout({ children }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    notFound();
  }

  return <AdminShell>{children}</AdminShell>;
}
