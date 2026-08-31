import { Suspense } from "react";
import { AdminUsersDirectory } from "@/components/admin/AdminUsersDirectory";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Users — Admin",
};

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <div className="aide-page space-y-3 pt-6">
          <Skeleton className="h-8 w-40 bg-[var(--color-border)]" />
          <Skeleton className="h-48 bg-[var(--color-border)]" />
        </div>
      }
    >
      <AdminUsersDirectory />
    </Suspense>
  );
}
