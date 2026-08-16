"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical, Pencil, Share2, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAgentCrumb } from "@/hooks/use-agent-crumb";
import { STUDIO_TABS, studioTabHref } from "@/components/agents/studio-tabs";
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

export function AgentHero({ agent, onDelete }) {
  useAgentCrumb(agent.name);
  const pathname = usePathname();
  const base = `/agents/${agent.id}`;

  const tabs = STUDIO_TABS.map((tab) => ({
    href: studioTabHref(agent.id, tab.segment),
    label: tab.label,
    exact: tab.id === "overview",
  }));

  return (
    <div className="hapy-card overflow-hidden">
      <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-sm font-semibold text-[var(--color-primary)]">
            {monogram(agent.name)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-[var(--color-text)]">
                {agent.name}
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted)]">
                <span className="size-1.5 rounded-full bg-[var(--color-success)]" />
                Active
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-[var(--color-text-secondary)]">
              {agent.description || "No description yet"}
            </p>
            {agent.createdAt ? (
              <p className="mt-1 text-[12px] text-[var(--color-muted)]">
                Created {formatDate(agent.createdAt)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`${base}/test`}
            className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
          >
            <FlaskConical className="size-3.5" />
            Test
          </Link>
          <Link
            href={`${base}/share`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <Share2 className="size-3.5" />
            Share
          </Link>
          <Link
            href={`/agents/${agent.id}/edit`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <Pencil className="size-3.5" />
            Edit
          </Link>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-[var(--color-danger)]"
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      </div>

      <nav
        className="flex gap-1 overflow-x-auto border-t border-[var(--color-border)] bg-[var(--color-bg)]/80 px-3"
        aria-label="Agent studio"
      >
        {tabs.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "shrink-0 -mb-px border-b-2 px-3 py-2.5 text-[13px] font-medium",
                active
                  ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                  : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
