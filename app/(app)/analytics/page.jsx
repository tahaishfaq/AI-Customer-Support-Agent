"use client";

import { WorkspaceAnalytics } from "@/components/analytics/WorkspaceAnalytics";
import { PageHeader } from "@/components/layout/PageHeader";

export default function AnalyticsPage() {
  return (
    <main className="hapy-page">
      <PageHeader
        title="Analytics"
        description="Workspace-wide insight across all of your agents — volume, sentiment, timing, and how each agent compares."
      />
      <div className="mt-6">
        <WorkspaceAnalytics />
      </div>
    </main>
  );
}
