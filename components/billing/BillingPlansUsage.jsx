"use client";

import Link from "next/link";
import { ConversationQuotaMeter } from "@/components/billing/ConversationQuotaMeter";
import { useConversationQuota } from "@/hooks/use-conversation-quota";

export function BillingPlansUsage() {
  const { quota, billing, loading } = useConversationQuota();

  if (loading || !quota) return null;

  return (
    <div className="mb-8">
      <ConversationQuotaMeter quota={quota} billing={billing} variant="strip" />
      {quota.unlimited ? null : (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Need more volume? Pick a higher plan below.
        </p>
      )}
    </div>
  );
}

export function isConversationLimitError(err) {
  return (
    err?.code === "conversation_limit_reached" ||
    err?.details?.code === "conversation_limit_reached" ||
    err?.status === 402
  );
}

export function ConversationLimitNotice({ message, className }) {
  if (!message) return null;
  return (
    <div className={className}>
      <p className="text-sm text-destructive">{message}</p>
      <Link
        href="/billing/plans"
        className="mt-1 inline-block text-sm font-medium text-primary underline underline-offset-2"
      >
        Upgrade plan or wait for monthly reset
      </Link>
    </div>
  );
}
