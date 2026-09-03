"use client";

import Link from "next/link";
import { useConversationQuota } from "@/hooks/use-conversation-quota";
import { useAuthStore } from "@/store/auth-store";

export function BillingPastDueBanner() {
  const user = useAuthStore((s) => s.user);
  const enabled = user?.role !== "ADMIN";
  const { billing, loading } = useConversationQuota({ enabled });

  if (!enabled || loading || !billing) return null;
  if (billing.status !== "PAST_DUE") return null;

  return (
    <div className="border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-950 dark:text-amber-100 sm:px-4">
      <span className="font-medium">Payment past due.</span>{" "}
      New agents and workspaces are paused until billing is updated.{" "}
      <Link
        href="/settings/billing"
        className="font-semibold text-primary underline-offset-2 hover:underline"
      >
        Billing settings
      </Link>
    </div>
  );
}
