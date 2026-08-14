"use client";

import { AnalyticsBoard } from "@/components/analytics/AnalyticsBoard";
import { PageHeader } from "@/components/layout/PageHeader";

export default function AnalyticsPage() {
  return (
    <main className="hapy-page">
      <PageHeader
        title="Analytics"
        description="Workspace conversations, sentiment, and topics."
      />
      <div className="mt-6">
        <AnalyticsBoard />
      </div>
    </main>
  );
}
