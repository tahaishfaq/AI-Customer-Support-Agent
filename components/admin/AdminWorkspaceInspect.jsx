"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getAdminWorkspace, getAdminWorkspaceDashboard } from "@/lib/api/admin";
import { WorkspaceAnalytics } from "@/components/analytics/WorkspaceAnalytics";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function formatWhen(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function AdminWorkspaceInspect() {
  const params = useParams();
  const userId = params?.id;
  const workspaceId = params?.workspaceId;
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(
    ({ range } = {}) => getAdminWorkspaceDashboard({ workspaceId, range }),
    [workspaceId]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!workspaceId) return;
      setLoading(true);
      setError("");
      try {
        const data = await getAdminWorkspace(workspaceId);
        if (!cancelled) setWorkspace(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load workspace");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  if (loading) {
    return (
      <main className="hapy-page">
        <Skeleton className="h-10 w-64 bg-[var(--color-border)]" />
        <Skeleton className="mt-6 h-40 w-full bg-[var(--color-border)]" />
      </main>
    );
  }

  if (error || !workspace) {
    return (
      <main className="hapy-page">
        <p className="text-sm text-[var(--color-danger)]">
          {error || "Workspace not found"}
        </p>
        <Link
          href={`/admin/users/${userId}`}
          className="mt-3 inline-block text-sm font-medium text-[var(--color-primary)] underline"
        >
          Back to user
        </Link>
      </main>
    );
  }

  const agents = workspace.agents || [];

  return (
    <main className="hapy-page">
      <p className="mb-3 text-[12px] text-[var(--color-muted)]">
        <Link href="/admin/users" className="hover:underline">
          Users
        </Link>
        {" / "}
        <Link href={`/admin/users/${workspace.user.id}`} className="hover:underline">
          {workspace.user.name}
        </Link>
        {" / "}
        <span>{workspace.name}</span>
      </p>
      <PageHeader
        title={workspace.name}
        description={`${workspace.user.email} · created ${formatWhen(workspace.createdAt)}`}
      />

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">Agents</h2>
        {agents.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-[var(--color-border)] bg-white px-5 py-10 text-center text-sm text-[var(--color-muted)]">
            No agents in this workspace.
          </p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {agents.map((agent) => (
              <li key={agent.id}>
                <Link
                  href={`/admin/users/${workspace.user.id}/workspaces/${workspace.id}/agents/${agent.id}`}
                  className="block rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 hover:bg-[var(--color-bg)]"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-[var(--color-text)]">
                        {agent.name}
                      </span>
                      <span className="mt-1 block text-[12px] text-[var(--color-muted)]">
                        {agent.knowledgeCount} knowledge · {agent.conversationCount}{" "}
                        chats
                      </span>
                      {agent.siteKnowledgeOrigin ? (
                        <span className="mt-1 block truncate text-[12px] text-[var(--color-primary)]">
                          {String(agent.siteKnowledgeOrigin).replace(/^https?:\/\//, "")}
                        </span>
                      ) : (
                        <span className="mt-1 block text-[12px] text-[var(--color-muted)]">
                          Not embedded
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          agent.enabled
                            ? "bg-[var(--color-success)]/10 text-[var(--color-success)]"
                            : "bg-[var(--color-danger)]/10 text-[var(--color-danger)]"
                        )}
                      >
                        {agent.enabled ? "Live" : "Disabled"}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          agent.embedEnabled
                            ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                            : "bg-[var(--color-bg)] text-[var(--color-muted)]"
                        )}
                      >
                        {agent.embedEnabled ? "Embed on" : "Embed off"}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-sm font-semibold text-[var(--color-text)]">
          Workspace analytics
        </h2>
        <WorkspaceAnalytics
          loader={loadDashboard}
          hideManageAgents
          agentHref={(agentId) =>
            `/admin/users/${workspace.user.id}/workspaces/${workspace.id}/agents/${agentId}`
          }
        />
      </section>
    </main>
  );
}
