"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";
import {
  buildExport,
  downloadCsv,
  exportFilename,
} from "@/lib/analytics/export-csv";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const BASE_OPTIONS = [
  { id: "summary", label: "Summary KPIs", hint: "Overview for this range" },
  { id: "agents", label: "Agents", hint: "Per-agent breakdown" },
  { id: "trends", label: "Trends", hint: "Conversations over time" },
  { id: "topics", label: "Topics", hint: "Category distribution" },
  { id: "sentiment", label: "Sentiment", hint: "Positive / neutral / negative" },
];

const PLATFORM_OPTION = {
  id: "growth",
  label: "Platform growth",
  hint: "Users, agents, embeds, chats",
};

export function AnalyticsExportMenu({
  data,
  range,
  scope = "workspace",
  disabled = false,
  includeGrowth = false,
  className,
}) {
  const options = includeGrowth
    ? [...BASE_OPTIONS, PLATFORM_OPTION]
    : BASE_OPTIONS;

  function handleExport(kind) {
    if (!data) {
      toast.error("Load analytics before exporting");
      return;
    }
    try {
      const body = buildExport(kind, data, { scope, range });
      downloadCsv(exportFilename(scope, range, kind), body);
      toast.success("CSV download started");
    } catch (err) {
      toast.error(err.message || "Export failed");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled || !data}
        className={cn(buttonVariants({ size: "sm" }), className)}
      >
        <Download className="size-3.5" aria-hidden />
        Export
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Download CSV</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuItem
            key={option.id}
            onClick={() => handleExport(option.id)}
          >
            <div className="flex flex-col gap-0.5">
              <span>{option.label}</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                {option.hint}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
