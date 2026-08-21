"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  FlaskConical,
  MoreHorizontal,
  Pencil,
  Rocket,
  Trash2,
} from "lucide-react";
import { DeleteAgentDialog } from "@/components/agents/DeleteAgentDialog";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function AgentStatusBadge({ agent, className }) {
  const disabled = agent?.enabled === false;
  const embedOff = !disabled && agent?.embedEnabled === false;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1",
        disabled
          ? "bg-[var(--color-danger)]/10 text-[var(--color-danger)] ring-[var(--color-danger)]/20"
          : embedOff
            ? "bg-white text-[var(--color-muted)] ring-[var(--color-border)]"
            : "bg-white text-[var(--color-muted)] ring-[var(--color-border)]",
        className
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          disabled
            ? "bg-[var(--color-danger)]"
            : embedOff
              ? "bg-[var(--color-muted)]"
              : "bg-[var(--color-success)]"
        )}
      />
      {disabled ? "Disabled" : embedOff ? "Embed off" : "Ready"}
    </span>
  );
}

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

function IconTip({ label, children }) {
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--color-text)] px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-sm transition-opacity group-hover/tip:opacity-100">
        {label}
      </span>
    </span>
  );
}

export function AgentCard({ agent, onDeleted }) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] transition-colors hover:border-[var(--color-primary)]/25">
        <div
          className="px-5 pt-5 pb-4"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in srgb, var(--color-primary) 8%, white) 0%, white 100%)",
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary)] font-[family-name:var(--font-display)] text-sm font-semibold text-white shadow-sm">
              {monogram(agent.name)}
            </span>
            <AgentStatusBadge agent={agent} />
          </div>
          <Link href={`/agents/${agent.id}`} className="mt-4 block min-w-0">
            <h3 className="truncate font-[family-name:var(--font-display)] text-[16px] font-semibold tracking-tight text-[var(--color-text)] group-hover:text-[var(--color-primary)]">
              {agent.name}
            </h3>
            <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
              {agent.description || "No description yet"}
            </p>
          </Link>
        </div>

        <div className="mt-auto border-t border-[var(--color-border)] px-5 py-3.5">
          <p className="text-[11px] text-[var(--color-muted)]">
            Created {formatDate(agent.createdAt)}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Link
              href={`/agents/${agent.id}`}
              className={cn(buttonVariants({ size: "sm" }), "gap-1")}
            >
              Open
            </Link>
            <Link
              href={`/agents/${agent.id}/test`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Test
            </Link>
            <div className="ml-auto flex items-center">
              <IconTip label="Knowledge">
                <Link
                  href={`/agents/${agent.id}/knowledge`}
                  className="flex size-8 items-center justify-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
                >
                  <BookOpen className="size-4" />
                  <span className="sr-only">Knowledge</span>
                </Link>
              </IconTip>
              <IconTip label="Analytics">
                <Link
                  href={`/agents/${agent.id}/analytics`}
                  className="flex size-8 items-center justify-center rounded-lg text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
                >
                  <BarChart3 className="size-4" />
                  <span className="sr-only">Analytics</span>
                </Link>
              </IconTip>
              <IconTip label="More">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="flex size-8 items-center justify-center rounded-lg text-[var(--color-muted)] outline-none hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
                    aria-label="More actions"
                  >
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-40">
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => router.push(`/agents/${agent.id}/test`)}
                    >
                      <FlaskConical className="size-3.5" />
                      Test
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() =>
                        router.push(`/agents/${agent.id}/customization`)
                      }
                    >
                      <Rocket className="size-3.5" />
                      Deploy
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => router.push(`/agents/${agent.id}/edit`)}
                    >
                      <Pencil className="size-3.5" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      className="cursor-pointer"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </IconTip>
            </div>
          </div>
        </div>
      </article>

      <DeleteAgentDialog
        agent={agent}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={onDeleted}
      />
    </>
  );
}
