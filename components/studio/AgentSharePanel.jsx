"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, ExternalLink, Share2 } from "lucide-react";
import { toast } from "sonner";
import { buttonVariants } from "@/components/ui/button";
import { resolveCustomization } from "@/lib/customization/defaults";
import { buildEmbedSnippet } from "@/lib/customization/embed";
import { cn } from "@/lib/utils";

export function AgentSharePanel({ agent }) {
  const customization = useMemo(() => resolveCustomization(agent), [agent]);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("https://your-app.com");
  const snippet = useMemo(
    () => buildEmbedSnippet(agent.id, origin),
    [agent.id, origin]
  );

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const deploy = customization.deploy;
  const identity = customization.identity;

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      toast.success("Embed code copied");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy");
    }
  }

  const checklist = [
    {
      done: Boolean(agent.systemPrompt?.trim()),
      label: "Instructions",
      href: `/agents/${agent.id}/edit`,
    },
    {
      done: Boolean(agent.welcomeMessage?.trim()),
      label: "Welcome message",
      href: `/agents/${agent.id}/edit`,
    },
    {
      done: Boolean(agent.customization),
      label: "Widget look",
      href: `/agents/${agent.id}/customization`,
    },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
      <section className="hapy-card p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <Share2 className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              Share placeholder
            </h2>
            <p className="mt-0.5 text-[12px] text-[var(--color-muted)]">
              Copy the snippet now. Public bubble embed + public API land in
              the next phase — this tab is ready to swap in the live key.
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[#0f172a]">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <span className="text-[11px] text-slate-400">embed snippet</span>
            <button
              type="button"
              onClick={copySnippet}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-white/10"
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-400" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="overflow-x-auto p-3 text-[11px] leading-relaxed text-slate-200">
            <code>{snippet}</code>
          </pre>
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)]/70 px-4 py-3 text-[13px] text-[var(--color-text-secondary)]">
          Until public embed ships, visitors can still talk to this agent from{" "}
          <Link
            href={`/chat?agentId=${agent.id}`}
            className="font-medium text-[var(--color-primary)] hover:underline"
          >
            Chat
          </Link>{" "}
          or the{" "}
          <Link
            href={`/agents/${agent.id}/test`}
            className="font-medium text-[var(--color-primary)] hover:underline"
          >
            Test
          </Link>{" "}
          tab.
        </div>
      </section>

      <div className="space-y-4">
        <section className="hapy-card p-5">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">
            Deploy settings
          </h2>
          <dl className="mt-3 space-y-3 text-[13px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--color-muted)]">Display name</dt>
              <dd className="truncate font-medium text-[var(--color-text)]">
                {identity.displayName || agent.name}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--color-muted)]">Interface</dt>
              <dd className="font-medium capitalize text-[var(--color-text)]">
                {deploy.chatInterface === "embedded" ? "Embedded" : "Toggle"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--color-muted)]">Launcher</dt>
              <dd className="font-medium capitalize text-[var(--color-text)]">
                {deploy.chatLauncher === "custom" ? "Custom element" : "Chat bubble"}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--color-muted)]">Proactive</dt>
              <dd className="font-medium text-[var(--color-text)]">
                {deploy.proactiveEnabled ? "On" : "Off"}
              </dd>
            </div>
          </dl>
          <Link
            href={`/agents/${agent.id}/customization`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "mt-4 inline-flex gap-1.5"
            )}
          >
            Edit in Customization
            <ExternalLink className="size-3.5" />
          </Link>
        </section>

        <section className="hapy-card p-5">
          <h2 className="text-sm font-semibold text-[var(--color-text)]">
            Before you share
          </h2>
          <ul className="mt-3 space-y-2">
            {checklist.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="flex items-center gap-2.5 rounded-lg px-1 py-1 hover:bg-[var(--color-bg)]"
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                      item.done
                        ? "bg-[var(--color-success)]/15 text-[var(--color-success)]"
                        : "bg-[var(--color-bg)] text-[var(--color-muted)] ring-1 ring-[var(--color-border)]"
                    )}
                  >
                    {item.done ? "✓" : ""}
                  </span>
                  <span className="text-[13px] text-[var(--color-text)]">
                    {item.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
