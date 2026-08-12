"use client";

import { Suspense } from "react";
import Link from "next/link";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";
import { Skeleton } from "@/components/ui/skeleton";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function ChatFallback() {
  return (
    <div className="flex h-[min(70vh,640px)] flex-col overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
      <div className="border-b border-[var(--color-border)] px-6 py-4">
        <Skeleton className="h-10 w-56 bg-[var(--color-border)]" />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-6">
        <Skeleton className="h-16 w-2/3 rounded-2xl bg-[var(--color-border)]" />
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="animate-fade-up mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--color-primary)]">Chat</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-text)]">
            Talk to your agent
          </h1>
          <p className="mt-2 text-[var(--color-text-secondary)]">
            Multi-turn support chat powered by your agent knowledge.
          </p>
        </div>
        <Link
          href="/conversations"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          View conversations
        </Link>
      </div>

      <div className="animate-fade-up-delay-1">
        <Suspense fallback={<ChatFallback />}>
          <ChatWorkspace />
        </Suspense>
      </div>
    </main>
  );
}
