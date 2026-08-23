"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAgentCrumb } from "@/hooks/use-agent-crumb";
import { STUDIO_TABS, studioTabHref } from "@/components/agents/studio-tabs";
import { cn } from "@/lib/utils";

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

  const tabs = STUDIO_TABS.map((tab) => ({
    href: studioTabHref(agent.id, tab.segment),
    label: tab.label,
    group: tab.group,
    exact: tab.id === "overview",
  }));

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)]">
      {/* Identity row — one job: who is this agent */}
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-sm font-semibold text-[var(--color-primary)]">
            {monogram(agent.name)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-[var(--color-text)] sm:text-xl">
                {agent.name}
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-bg)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-muted)]">
                <span className="size-1.5 rounded-full bg-[var(--color-success)]" />
                Active
              </span>
            </div>
            {agent.description ? (
              <p className="mt-0.5 line-clamp-1 text-sm text-[var(--color-text-secondary)]">
                {agent.description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
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
            className="gap-1.5 text-[var(--color-danger)]"
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Studio tabs — build path, then insights */}
      <nav
        className="flex flex-nowrap items-stretch gap-0 overflow-x-auto overscroll-x-contain border-t border-[var(--color-border)] bg-[var(--color-bg)]/60 px-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:overflow-x-hidden"
        aria-label="Agent studio"
      >
        {tabs.map((tab, index) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          const prev = tabs[index - 1];
          const showDivider =
            prev && prev.group === "build" && tab.group === "insights";

          return (
            <div key={tab.href} className="flex shrink-0 items-stretch">
              {showDivider ? (
                <span
                  className="mx-1 my-2 w-px bg-[var(--color-border)]"
                  aria-hidden
                />
              ) : null}
              <Link
                href={tab.href}
                className={cn(
                  "shrink-0 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors",
                  active
                    ? "border-[var(--color-primary)] text-[var(--color-primary)]"
                    : "border-transparent text-[var(--color-muted)] hover:text-[var(--color-text)]"
                )}
              >
                {tab.label}
              </Link>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
