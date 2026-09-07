"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  getAgentEmbedHealth,
  retestAgentEmbedHealth,
} from "@/lib/api/agents";
import { cn } from "@/lib/utils";

const DOT = {
  pending: "bg-muted-foreground/35",
  pass: "bg-emerald-600",
  fail: "bg-destructive",
  warn: "bg-amber-500",
};

function overallCopy(health) {
  if (!health) return { title: "Embed checklist", detail: "Checking…" };
  if (health.ready) {
    return {
      title: "Embed is ready",
      detail: health.liveOrigin
        ? `Live on ${safeHost(health.liveOrigin)}.`
        : "Live checks passed.",
    };
  }
  const failed = (health.parts || health.checks || []).some((c) => c.state === "fail");
  if (failed) {
    return {
      title: "Not ready",
      detail: "Open the red step for what to fix.",
    };
  }
  return {
    title: "Three steps to go live",
    detail: "Grey until the snippet runs on your website. Aide preview and localhost do not count.",
  };
}

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return String(url || "");
  }
}

function StatusRow({ item }) {
  return (
    <li className="flex gap-2.5">
      <span
        className={cn(
          "mt-1.5 size-2 shrink-0 rounded-full",
          DOT[item.state] || DOT.pending
        )}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-xs font-medium leading-snug">{item.title || item.name}</p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {item.reason}
        </p>
      </div>
    </li>
  );
}

export function EmbedReadinessChecklist({ agentId }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retesting, setRetesting] = useState(false);
  const [openPart, setOpenPart] = useState(null);
  const autoRetest = useRef(false);

  const load = useCallback(async () => {
    const data = await getAgentEmbedHealth(agentId);
    setHealth(data);
    return data;
  }, [agentId]);

  useEffect(() => {
    let cancelled = false;
    autoRetest.current = false;
    setLoading(true);
    load()
      .catch(() => {
        if (!cancelled) toast.error("Could not load embed checklist");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (!health?.stale || !health.liveOrigin || autoRetest.current || retesting) return;
    autoRetest.current = true;
    setRetesting(true);
    retestAgentEmbedHealth(agentId)
      .then((data) => setHealth(data))
      .catch(() => {
        autoRetest.current = false;
      })
      .finally(() => setRetesting(false));
  }, [agentId, health, retesting]);

  async function handleRetest() {
    setRetesting(true);
    try {
      const data = await retestAgentEmbedHealth(agentId);
      setHealth(data);
      toast.success(data.ready ? "Embed is ready" : "Checks updated");
    } catch (err) {
      toast.error(err.message || "Retest failed");
    } finally {
      setRetesting(false);
    }
  }

  const copy = overallCopy(health);
  const parts = health?.parts || [];
  const summaryState = health?.ready
    ? "pass"
    : (health?.parts || health?.checks || []).some((c) => c.state === "fail")
      ? "fail"
      : (health?.parts || []).some((c) => c.state === "warn")
        ? "warn"
        : "pending";

  return (
    <>
    <Collapsible defaultOpen={false} className="group mb-4 rounded-lg border border-border bg-card">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-medium outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/40">
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[open]:rotate-90" />
        <span className="min-w-0 flex-1 truncate">Embedded Checklist</span>
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            DOT[summaryState]
          )}
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
    <Alert className="rounded-none border-0 border-t border-border">
      <ShieldCheck />
      <AlertTitle>{copy.title}</AlertTitle>
      <AlertAction>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 rounded-full px-2.5 text-xs"
          disabled={retesting || loading}
          onClick={handleRetest}
        >
          {retesting ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RefreshCw data-icon="inline-start" />
          )}
          Re-test
        </Button>
      </AlertAction>
      <AlertDescription className="space-y-3 text-xs leading-relaxed">
        <p>{copy.detail}</p>
        {loading && !health ? (
          <p className="text-muted-foreground">Loading checks…</p>
        ) : (
          <ol className="space-y-1">
            {parts.map((part, index) => (
              <li
                key={part.id}
                className="flex items-center gap-2.5 rounded-md py-1"
              >
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    DOT[part.state] || DOT.pending
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                  {index + 1}. {part.title}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 shrink-0 px-2 text-[11px] text-muted-foreground"
                  onClick={() => setOpenPart(part)}
                >
                  Details
                </Button>
              </li>
            ))}
          </ol>
        )}
      </AlertDescription>
    </Alert>
      </CollapsibleContent>
    </Collapsible>

      <Dialog open={Boolean(openPart)} onOpenChange={(next) => !next && setOpenPart(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{openPart?.title}</DialogTitle>
            <DialogDescription>
              What this step checks. Aide cannot verify your own ACL from here.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2.5">
            {(openPart?.items || []).map((item) => (
              <StatusRow key={item.id} item={item} />
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
