"use client";

import { InboxShell } from "@/components/desk/InboxShell";
import { DeskEmptyState } from "@/components/desk/DeskThread";

export default function InboxPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
      <InboxShell>
        <DeskEmptyState />
      </InboxShell>
    </div>
  );
}
