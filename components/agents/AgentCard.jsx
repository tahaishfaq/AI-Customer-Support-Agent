"use client";

import Link from "next/link";
import { useState } from "react";
import { Pencil, Trash2, ArrowUpRight, BookOpen, MessageSquare } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { DeleteAgentDialog } from "@/components/agents/DeleteAgentDialog";
import { cn } from "@/lib/utils";

function formatDate(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function monogram(name) {
  if (!name) return "A";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function AgentCard({ agent }) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-[var(--color-primary)]/25 hover:shadow-md">
        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)]/10 font-[family-name:var(--font-display)] text-sm font-semibold text-[var(--color-primary)]">
              {monogram(agent.name)}
            </span>
            <div className="min-w-0 flex-1">
              <Link
                href={`/agents/${agent.id}`}
                className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-[var(--color-text)] transition hover:text-[var(--color-primary)]"
              >
                {agent.name}
              </Link>
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {agent.description || "No description yet"}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-2 border-t border-[var(--color-border)] pt-4">
            <p className="text-xs text-[var(--color-muted)]">
              Created {formatDate(agent.createdAt)}
            </p>
            <span className="rounded-full bg-[var(--color-bg)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-muted)]">
              Ready
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg)]/60 px-4 py-3">
          <Link
            href={`/agents/${agent.id}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-1.5 bg-white"
            )}
          >
            Open
            <ArrowUpRight className="size-3.5" />
          </Link>
          <Link
            href={`/agents/${agent.id}/knowledge`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-1.5 bg-white"
            )}
          >
            <BookOpen className="size-3.5" />
            Knowledge
          </Link>
          <Link
            href={`/chat?agentId=${agent.id}`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-1.5 bg-white"
            )}
          >
            <MessageSquare className="size-3.5" />
            Chat
          </Link>
          <Link
            href={`/agents/${agent.id}/edit`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-1.5 bg-white"
            )}
          >
            <Pencil className="size-3.5" />
            Edit
          </Link>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 bg-white text-[var(--color-danger)] hover:bg-[var(--color-danger)]/5"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      </article>

      <DeleteAgentDialog
        agent={agent}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
