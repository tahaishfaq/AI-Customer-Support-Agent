import { Suspense } from "react";
import { AdminPlatformAnalytics } from "@/components/admin/AdminPlatformAnalytics";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Dashboard — Admin",
};

export default function AdminHomePage() {
  return (
    <Suspense
      fallback={
        <div className="aide-page space-y-3 pt-6">
          <Skeleton className="h-8 w-52 bg-[var(--color-border)]" />
          <Skeleton className="h-48 bg-[var(--color-border)]" />
        </div>
      }
    >
      <AdminPlatformAnalytics />
    </Suspense>
  );
}
