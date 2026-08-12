"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Pencil, Trash2, BookOpen, MessageSquare } from "lucide-react";
import { getAgent } from "@/lib/api/agents";
import { DeleteAgentDialog } from "@/components/agents/DeleteAgentDialog";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function AgentDetailPage() {
  const params = useParams();
  const id = params?.id;
  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await getAgent(id);
        if (!cancelled) setAgent(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load agent");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <Skeleton className="h-8 w-48 bg-[var(--color-border)]" />
        <Skeleton className="mt-6 h-64 w-full rounded-3xl bg-[var(--color-border)]" />
      </main>
    );
  }

  if (error || !agent) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <p className="text-sm text-[var(--color-danger)]">
          {error || "Agent not found"}
        </p>
        <Link
          href="/agents"
          className="mt-4 inline-block text-sm font-medium text-[var(--color-primary)] underline"
        >
          Back to agents
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="animate-fade-up">
        <Link
          href="/agents"
          className="text-sm font-medium text-[var(--color-primary)] underline-offset-2 hover:underline"
        >
          ← Back to agents
        </Link>

        <div className="mt-5 overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
          <div
            className="border-b border-[var(--color-border)] px-6 py-7 sm:px-8"
            style={{
              background:
                "linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 8%, white), white)",
            }}
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium text-[var(--color-primary)]">
                  Agent
                </p>
                <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-text)]">
                  {agent.name}
                </h1>
                <p className="mt-2 text-[var(--color-text-secondary)]">
                  {agent.description || "No description"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/chat?agentId=${agent.id}`}
                  className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
                >
                  <MessageSquare className="size-3.5" />
                  Chat
                </Link>
                <Link
                  href={`/agents/${agent.id}/knowledge`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "gap-1.5"
                  )}
                >
                  <BookOpen className="size-3.5" />
                  Knowledge
                </Link>
                <Link
                  href={`/agents/${agent.id}/edit`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "gap-1.5"
                  )}
                >
                  <Pencil className="size-3.5" />
                  Edit
                </Link>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-6 px-6 py-7 sm:px-8">
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                Welcome message
              </h2>
              <p className="mt-2 rounded-2xl bg-[var(--color-bg)] px-4 py-3 text-[var(--color-text)]">
                {agent.welcomeMessage}
              </p>
            </section>

            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                System prompt
              </h2>
              <p className="mt-2 whitespace-pre-wrap rounded-2xl bg-[var(--color-bg)] px-4 py-3 text-sm leading-relaxed text-[var(--color-text)]">
                {agent.systemPrompt}
              </p>
            </section>

            <p className="text-sm text-[var(--color-muted)]">
              Use Chat to talk with this agent using its system prompt and
              knowledge.
            </p>
          </div>
        </div>
      </div>

      <DeleteAgentDialog
        agent={agent}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </main>
  );
}
