"use client";

import { Suspense } from "react";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";
import { Skeleton } from "@/components/ui/skeleton";

function ChatFallback() {
  return (
    <div className="flex h-full flex-col bg-[var(--color-surface)]">
      <div className="border-b border-[var(--color-border)] px-4 py-3">
        <Skeleton className="h-8 w-48 bg-[var(--color-border)]" />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <Skeleton className="h-14 w-2/3 rounded-2xl bg-[var(--color-border)]" />
        <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl bg-[var(--color-border)]" />
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden">
      <Suspense fallback={<ChatFallback />}>
        <ChatWorkspace />
      </Suspense>
    </main>
  );
}
