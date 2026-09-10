"use client";

import { Eye, Info, MessageSquareText, ShieldCheck, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function PromptLine({ children, className }) {
  return (
    <div className={cn("flex gap-3", className)}>
      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
      <span>{children}</span>
    </div>
  );
}

export function SystemPromptPreviewDialog({
  open,
  onOpenChange,
  agentName,
  welcomeMessage,
  systemPrompt,
}) {
  const prompt = systemPrompt?.trim() || "No system prompt configured yet.";
  const welcome = welcomeMessage?.trim() || "No welcome message configured yet.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(760px,90dvh)] w-[min(58rem,calc(100%-1.5rem))] flex-col gap-0 overflow-hidden border-white/10 bg-[#151519] p-0 text-white shadow-2xl sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-white/10 px-5 py-5 text-left sm:px-7">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <Sparkles className="size-3.5" />
            Agent voice
          </div>
          <DialogTitle className="pr-8 text-xl text-white sm:text-2xl">
            {agentName || "Agent"} prompt preview
          </DialogTitle>
          <DialogDescription className="max-w-2xl text-sm leading-relaxed text-white/55">
            Review the role instructions and the first message visitors will see.
            Platform grounding, safety, and tool rules are still added at runtime.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="grid gap-4 p-5 sm:p-7 lg:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)]">
            <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Role instructions</p>
                  <p className="mt-1 text-xs text-white/45">
                    The agent-specific prompt you control
                  </p>
                </div>
                <Badge className="shrink-0 rounded-full border border-primary/25 bg-primary/10 text-primary hover:bg-primary/10">
                  {prompt.length.toLocaleString()} chars
                </Badge>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="whitespace-pre-wrap font-mono text-[13px] leading-7 text-white/75">
                  {prompt}
                </p>
              </div>
              <div className="mt-4 flex gap-2 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.06] p-3 text-xs leading-relaxed text-white/55">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                <span>
                  Safety, grounding, language, handoff, and tool-confirmation rules
                  are protected platform rules.
                </span>
              </div>
            </section>

            <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Conversation preview</p>
                  <p className="mt-1 text-xs text-white/45">A quick look at the agent voice</p>
                </div>
                <Badge variant="outline" className="rounded-full border-white/15 text-white/55">
                  Preview only
                </Badge>
              </div>
              <div className="flex min-h-64 flex-col justify-end gap-3 rounded-xl border border-white/10 bg-[#0e0e11] p-4">
                <div className="flex items-start gap-2">
                  <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                    <MessageSquareText className="size-3.5" />
                  </span>
                  <div className="max-w-[90%] rounded-2xl rounded-tl-md bg-white/[0.08] px-3.5 py-3 text-sm leading-relaxed text-white/80">
                    {welcome}
                  </div>
                </div>
                <div className="ml-8 rounded-2xl rounded-br-md border border-primary/20 bg-primary/[0.08] px-3.5 py-3 text-sm leading-relaxed text-white/70">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                    Agent behavior
                  </p>
                  <div className="space-y-1.5">
                    <PromptLine>Uses the role and tone above</PromptLine>
                    <PromptLine>Grounds answers in configured knowledge</PromptLine>
                    <PromptLine>Uses enabled tools only when allowed</PromptLine>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex gap-2 text-xs leading-relaxed text-white/45">
                <Info className="mt-0.5 size-3.5 shrink-0" />
                This preview does not send a message or call a tool.
              </div>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
