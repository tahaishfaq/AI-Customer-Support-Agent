import { Suspense } from "react";
import { AdminAuditLog } from "@/components/admin/AdminAuditLog";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Audit — Admin",
};

export default function AdminAuditPage() {
  return (
    <Suspense
      fallback={
        <div className="aide-page space-y-3 pt-6">
          <Skeleton className="h-8 w-40 bg-[var(--color-border)]" />
          <Skeleton className="h-48 bg-[var(--color-border)]" />
        </div>
      }
    >
      <AdminAuditLog />
    </Suspense>
  );
}
