"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  getAdminAgent,
  setAdminAgentEmbedEnabled,
  setAdminAgentEnabled,
} from "@/lib/api/admin";
import { PreviewKnowledgeDialog } from "@/components/knowledge/PreviewKnowledgeDialog";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function AdminAgentInspect() {
  const params = useParams();
  const userId = params?.id;
  const workspaceId = params?.workspaceId;
  const agentId = params?.agentId;
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!agentId) return;
      setLoading(true);
      setError("");
      try {
        const data = await getAdminAgent(agentId);
        if (!cancelled) setAgent(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load agent");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  async function toggleEnabled() {
    setBusy("enabled");
    try {
      const updated = await setAdminAgentEnabled(agentId, !agent.enabled);
      setAgent((prev) => ({ ...prev, ...updated }));
      toast.success(updated.enabled ? "Agent enabled" : "Agent disabled");
    } catch (err) {
      toast.error(err.message || "Unable to update agent");
    } finally {
      setBusy("");
    }
  }

  async function toggleEmbed() {
    setBusy("embed");
    try {
      const updated = await setAdminAgentEmbedEnabled(
        agentId,
        !agent.embedEnabled
      );
      setAgent((prev) => ({ ...prev, ...updated }));
      toast.success(
        updated.embedEnabled ? "Public embed enabled" : "Public embed disabled"
      );
    } catch (err) {
      toast.error(err.message || "Unable to update embed");
    } finally {
      setBusy("");
    }
  }

  if (loading) {
    return (
      <main className="hapy-page">
        <Skeleton className="h-10 w-64 bg-[var(--color-border)]" />
        <Skeleton className="mt-6 h-48 w-full bg-[var(--color-border)]" />
      </main>
    );
  }

  if (error || !agent) {
    return (
      <main className="hapy-page">
        <p className="text-sm text-[var(--color-danger)]">
          {error || "Agent not found"}
        </p>
        <Link
          href={`/admin/users/${userId}/workspaces/${workspaceId}`}
          className="mt-3 inline-block text-sm font-medium text-[var(--color-primary)] underline"
        >
          Back to workspace
        </Link>
      </main>
    );
  }

  const customization = agent.customization || {};
  const identity = customization.identity || {};
  const appearance = customization.appearance || {};

  return (
    <main className="hapy-page">
      <p className="mb-3 text-[12px] text-[var(--color-muted)]">
        <Link href="/admin/users" className="hover:underline">
          Users
        </Link>
        {" / "}
        <Link href={`/admin/users/${agent.user.id}`} className="hover:underline">
          {agent.user.name}
        </Link>
        {" / "}
        <Link
          href={`/admin/users/${agent.user.id}/workspaces/${agent.workspace.id}`}
          className="hover:underline"
        >
          {agent.workspace.name}
        </Link>
        {" / "}
        <span>{agent.name}</span>
      </p>

      <PageHeader
        title={agent.name}
        description={agent.description || agent.user.email}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={agent.enabled ? "destructive" : "default"}
              disabled={Boolean(busy)}
              onClick={toggleEnabled}
            >
              {busy === "enabled"
                ? "Saving…"
                : agent.enabled
                  ? "Disable agent"
                  : "Enable agent"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={Boolean(busy)}
              onClick={toggleEmbed}
            >
              {busy === "embed"
                ? "Saving…"
                : agent.embedEnabled
                  ? "Disable embed"
                  : "Enable embed"}
            </Button>
            <Link
              href={`/admin/users/${agent.user.id}/workspaces/${agent.workspace.id}/agents/${agent.id}/conversations`}
              className="inline-flex h-8 items-center rounded-lg px-2.5 text-sm font-medium text-[var(--color-primary)] hover:underline"
            >
              Conversations
            </Link>
          </div>
        }
      />

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Info
          label="Agent"
          value={agent.enabled ? "Live" : "Disabled"}
          danger={!agent.enabled}
        />
        <Info
          label="Public embed"
          value={agent.embedEnabled ? "On" : "Off"}
          danger={!agent.embedEnabled}
        />
        <Info
          label="Live website"
          href={agent.siteKnowledgeOrigin || null}
          value={
            agent.siteKnowledgeOrigin
              ? String(agent.siteKnowledgeOrigin).replace(/^https?:\/\//, "")
              : "Not embedded"
          }
        />
        <Info label="Conversations" value={String(agent.conversationCount || 0)} />
        <Info
          label="Last chat"
          href={
            agent.lastChatId
              ? `/admin/users/${agent.user.id}/workspaces/${agent.workspace.id}/agents/${agent.id}/conversations/${agent.lastChatId}`
              : agent.lastChatAt
                ? `/admin/users/${agent.user.id}/workspaces/${agent.workspace.id}/agents/${agent.id}/conversations`
                : null
          }
          value={
            agent.lastChatAt
              ? new Date(agent.lastChatAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "Never"
          }
        />
      </section>

      <section className="mt-8 rounded-xl border border-[var(--color-border)] bg-white p-4">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">
          System prompt
        </h2>
        <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--color-text-secondary)]">
          {agent.systemPrompt}
        </pre>
        <p className="mt-4 text-[11px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
          Welcome message
        </p>
        <p className="mt-1 text-sm text-[var(--color-text)]">
          {agent.welcomeMessage}
        </p>
      </section>

      <section className="mt-8 rounded-xl border border-[var(--color-border)] bg-white p-4">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">
          Customization
        </h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <Mini label="Display name" value={identity.displayName || agent.name} />
          <Mini label="Primary color" value={appearance.primaryColor} />
          <Mini label="Theme" value={appearance.theme} />
          <Mini label="Chat interface" value={customization.deploy?.chatInterface} />
        </dl>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">
          Knowledge
        </h2>
        {(agent.knowledge || []).length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-[var(--color-border)] bg-white px-5 py-10 text-center text-sm text-[var(--color-muted)]">
            No knowledge documents.
          </p>
        ) : (
          <ul className="mt-3 overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
            {agent.knowledge.map((doc) => (
              <li key={doc.id} className="border-b border-[var(--color-border)] last:border-b-0">
                <button
                  type="button"
                  onClick={() => setPreview(doc)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--color-bg)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium text-[var(--color-text)]">
                      {doc.name}
                    </span>
                    <span className="text-[11px] text-[var(--color-muted)]">
                      {doc.type}
                      {doc.origin ? ` · ${doc.origin.replace(/^https?:\/\//, "")}` : ""}
                    </span>
                  </span>
                  <span className="text-[11px] font-medium text-[var(--color-primary)]">
                    View
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <PreviewKnowledgeDialog
        document={preview}
        open={Boolean(preview)}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      />
    </main>
  );
}

function Info({ label, value, danger, href }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3">
      <p className="text-[11px] font-medium text-[var(--color-muted)]">{label}</p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block truncate text-sm font-medium text-[var(--color-primary)] hover:underline"
        >
          {value}
        </a>
      ) : (
        <p
          className={cn(
            "mt-1 text-sm font-medium",
            danger ? "text-[var(--color-danger)]" : "text-[var(--color-text)]"
          )}
        >
          {value}
        </p>
      )}
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div>
      <dt className="text-[11px] text-[var(--color-muted)]">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-[var(--color-text)]">{value || "—"}</dd>
    </div>
  );
}
