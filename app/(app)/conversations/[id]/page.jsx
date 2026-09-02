"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getConversation } from "@/lib/api/conversations";

export default function ConversationLegacyRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;

  useEffect(() => {
    if (!id) return undefined;
    let cancelled = false;

    getConversation(id)
      .then((data) => {
        if (cancelled) return;
        if (data?.agentId) {
          router.replace(`/agents/${data.agentId}/conversations/${id}`);
        } else {
          router.replace("/agents");
        }
      })
      .catch(() => {
        if (!cancelled) router.replace("/agents");
      });

    return () => {
      cancelled = true;
    };
  }, [id, router]);

  return (
    <main className="aide-page">
      <p className="text-sm text-[var(--color-muted)]">Opening conversation…</p>
    </main>
  );
}
