import { Suspense } from "react";
import { AdminWorkspaceInspect } from "@/components/admin/AdminWorkspaceInspect";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Workspace — Admin",
};

export default function AdminWorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="aide-page pt-6">
          <Skeleton className="h-10 w-56 bg-[var(--color-border)]" />
        </div>
      }
    >
      <AdminWorkspaceInspect />
    </Suspense>
  );
}
