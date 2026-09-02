"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { AgentStatusBadge } from "@/components/agents/AgentCard";
import { Button, buttonVariants } from "@/components/ui/button";
import { useAgentCrumb } from "@/hooks/use-agent-crumb";
import { STUDIO_TABS, studioTabHref } from "@/components/agents/studio-tabs";
import { cn } from "@/lib/utils";

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
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 px-3 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate font-heading text-lg font-semibold tracking-tight sm:text-xl">
              {agent.name}
            </h1>
            <AgentStatusBadge agent={agent} />
          </div>
          {agent.description ? (
            <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
              {agent.description}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/agents/${agent.id}/edit`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "rounded-full"
            )}
          >
            <Pencil data-icon="inline-start" />
            Edit
          </Link>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full text-destructive"
            onClick={onDelete}
          >
            <Trash2 data-icon="inline-start" />
            Delete
          </Button>
        </div>
      </div>

      <nav
        className="flex flex-nowrap items-stretch gap-0 overflow-x-auto overscroll-x-contain border-t border-border bg-muted/40 px-1 sm:px-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:overflow-x-hidden"
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
                  className="mx-1 my-2 w-px bg-border"
                  aria-hidden
                />
              ) : null}
              <Link
                href={tab.href}
                className={cn(
                  "shrink-0 border-b-2 px-2.5 py-2 text-[12px] font-medium transition-colors sm:px-3 sm:py-2.5 sm:text-[13px]",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
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
