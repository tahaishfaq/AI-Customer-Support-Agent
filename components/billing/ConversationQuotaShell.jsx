"use client";

import { useConversationQuota } from "@/hooks/use-conversation-quota";
import { conversationQuotaWarningLevel } from "@/lib/billing/conversation-quota-ui";
import { ConversationQuotaMeter } from "@/components/billing/ConversationQuotaMeter";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth-store";

function ConversationQuotaSidebarSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm">
      <div className="space-y-2 px-3 pt-3 pb-2.5">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-4 w-10" />
        </div>
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-3 w-28" />
      </div>
      <Skeleton className="h-9 w-full rounded-none" />
    </div>
  );
}

export function ConversationQuotaBanner() {
  const user = useAuthStore((s) => s.user);
  const enabled = user?.role !== "ADMIN";
  const { quota, billing, loading } = useConversationQuota({ enabled });

  if (!enabled || loading || !quota || quota.unlimited) return null;

  const level = conversationQuotaWarningLevel(quota);
  if (level === "ok") return null;

  return <ConversationQuotaMeter quota={quota} billing={billing} variant="banner" />;
}

export function ConversationQuotaTopbar() {
  const user = useAuthStore((s) => s.user);
  const enabled = user?.role !== "ADMIN";
  const { quota, billing, loading } = useConversationQuota({ enabled });

  if (!enabled || loading || !quota) return null;

  return (
    <ConversationQuotaMeter
      quota={quota}
      billing={billing}
      variant="compact"
    />
  );
}

export function ConversationQuotaSidebar() {
  const user = useAuthStore((s) => s.user);
  const enabled = user?.role !== "ADMIN";
  const { quota, billing, loading } = useConversationQuota({ enabled });

  if (!enabled) return null;

  return (
    <>
      <div className="group-data-[collapsible=icon]:hidden">
        {loading || !quota ? (
          <ConversationQuotaSidebarSkeleton />
        ) : (
          <ConversationQuotaMeter
            quota={quota}
            billing={billing}
            variant="sidebar"
          />
        )}
      </div>
      {!loading && quota ? (
        <div className="hidden group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
          <ConversationQuotaMeter
            quota={quota}
            billing={billing}
            variant="sidebar-icon"
          />
        </div>
      ) : null}
    </>
  );
}
