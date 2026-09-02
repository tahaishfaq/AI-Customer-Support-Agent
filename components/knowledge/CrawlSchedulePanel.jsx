"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { updateAgent } from "@/lib/api/agents";
import {
  FieldBlock,
  FormSection,
  fieldClass,
} from "@/components/customization/CustomizationFields";
import {
  CRAWL_RECRAWL_OPTIONS,
  labelForCrawlRecrawlHours,
  nextRecrawlAt,
} from "@/lib/services/crawl-schedule";
import { cn } from "@/lib/utils";

/**
 * Schedule website knowledge refresh.
 * Note: Aide does not watch the live site for edits — refresh runs when the
 * interval is due and a visitor loads the embedded widget.
 */
export function CrawlSchedulePanel({
  agentId,
  crawlRecrawlHours = 0,
  siteCrawledAt = null,
  siteKnowledgeOrigin = null,
  hasWeb = false,
  onSaved,
  variant = "panel",
}) {
  const [value, setValue] = useState(crawlRecrawlHours ?? 0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(crawlRecrawlHours ?? 0);
  }, [crawlRecrawlHours]);

  const autoRefresh = value > 0;
  const nextAt =
    hasWeb && value > 0
      ? nextRecrawlAt({ crawlRecrawlHours: value, siteCrawledAt })
      : null;
  const changed = value !== (crawlRecrawlHours ?? 0);
  const intervalOptions = CRAWL_RECRAWL_OPTIONS.filter((opt) => opt.value > 0);
  const mode = autoRefresh ? "scheduled" : "once";

  async function save(nextValue = value) {
    setSaving(true);
    try {
      await updateAgent(agentId, { crawlRecrawlHours: nextValue });
      onSaved?.(nextValue);
      toast.success("Website crawl schedule saved");
    } catch (err) {
      toast.error(err.message || "Unable to save crawl schedule");
      setValue(crawlRecrawlHours ?? 0);
    } finally {
      setSaving(false);
    }
  }

  const scheduleControls = (
    <div className="flex flex-col gap-2.5">
      <ToggleGroup
        value={[mode]}
        onValueChange={(next) => {
          const picked = next?.[0];
          if (!picked) return;
          if (picked === "once") setValue(0);
          else if (value <= 0) setValue(24);
        }}
        variant="outline"
        size="sm"
        spacing={0}
        className="w-fit"
        aria-label="Crawl mode"
      >
        <ToggleGroupItem value="once" className="px-3">
          Once only
        </ToggleGroupItem>
        <ToggleGroupItem value="scheduled" className="px-3">
          Scheduled
        </ToggleGroupItem>
      </ToggleGroup>

      <p className="text-xs text-muted-foreground">
        {autoRefresh
          ? "Re-crawl on an interval when visitors load the widget."
          : "Crawl when first embedded. Site edits will not refresh knowledge."}
      </p>

      <div
        className={cn(
          "flex flex-wrap items-center gap-2",
          autoRefresh ? "justify-between" : "justify-end"
        )}
      >
        {autoRefresh ? (
          <Select
            value={String(value)}
            onValueChange={(next) => {
              if (next != null) setValue(Number(next));
            }}
          >
            <SelectTrigger className={cn(fieldClass, "h-8 w-[200px]")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {intervalOptions.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : null}
        <Button
          type="button"
          size="sm"
          disabled={!changed || saving}
          onClick={() => save(autoRefresh ? value : 0)}
        >
          {saving ? <Spinner data-icon="inline-start" /> : null}
          Save schedule
        </Button>
      </div>

      {hasWeb && siteCrawledAt ? (
        <p className="text-xs text-muted-foreground">
          Last crawl {new Date(siteCrawledAt).toLocaleString()}
          {siteKnowledgeOrigin
            ? ` from ${String(siteKnowledgeOrigin).replace(/^https?:\/\//, "")}`
            : ""}
          {autoRefresh
            ? nextAt
              ? `. Next eligible after ${nextAt.toLocaleString()}.`
              : ". Next eligible when the interval passes."
            : ". Switch to Scheduled if the site changes often."}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Embed the widget on your live https site first. Scheduled refresh
          runs after the interval on the next visitor visit.
        </p>
      )}

      {autoRefresh ? (
        <p className="text-xs text-muted-foreground">
          {labelForCrawlRecrawlHours(value)} · no separate cron needed.
        </p>
      ) : null}
    </div>
  );

  if (variant === "deploy") {
    return (
      <FormSection title="Website knowledge">
        <FieldBlock
          label="Re-crawl schedule"
          hint="Keep FAQ-from-website fresh. We refresh on a schedule when the widget loads — not the moment someone edits a page."
        >
          {scheduleControls}
        </FieldBlock>
      </FormSection>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-sm font-medium text-foreground">
        Website re-crawl schedule
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Default is once on first embed. Choose Scheduled to refresh when
        visitors load the widget.
      </p>
      <div className="mt-3">{scheduleControls}</div>
    </div>
  );
}
