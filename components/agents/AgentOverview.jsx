"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowRight,
  BookOpen,
  Clock,
  FileText,
  FlaskConical,
  MessageSquare,
  MessagesSquare,
  Palette,
  Sparkles,
} from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { buttonVariants } from "@/components/ui/button";
import { resolveCustomization } from "@/lib/customization/defaults";
import { cn } from "@/lib/utils";

function formatResponseTime(ms) {
  if (ms == null || ms === 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatWhen(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function SetupRow({ done, label, href, hint }) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-[var(--color-bg)]"
    >
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
          done
            ? "bg-[var(--color-success)]/15 text-[var(--color-success)]"
            : "bg-[var(--color-bg)] text-[var(--color-muted)] ring-1 ring-[var(--color-border)]"
        )}
      >
        {done ? "✓" : ""}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-[var(--color-text)]">
          {label}
        </span>
        <span className="mt-0.5 block text-[12px] text-[var(--color-muted)]">
          {hint}
        </span>
      </span>
      <ArrowRight className="mt-1 size-3.5 shrink-0 text-[var(--color-muted)]" />
    </Link>
  );
}

export function AgentOverview({ agent, overview, knowledgeCount, conversations }) {
  const customization = useMemo(
    () => resolveCustomization(agent),
    [agent]
  );

  const hasWelcome = Boolean(agent.welcomeMessage?.trim());
  const hasPrompt = Boolean(agent.systemPrompt?.trim());
  const hasKnowledge = knowledgeCount > 0;
  const hasCustomized = Boolean(agent.customization);
  const readyCount = [hasWelcome, hasPrompt, hasKnowledge, hasCustomized].filter(
    Boolean
  ).length;

  const shortcuts = [
    {
      href: `/agents/${agent.id}/test`,
      label: "Test",
      hint: "Studio emulator",
      icon: FlaskConical,
    },
    {
      href: `/agents/${agent.id}/knowledge`,
      label: "Knowledge",
      hint: `${knowledgeCount} source${knowledgeCount === 1 ? "" : "s"}`,
      icon: BookOpen,
    },
    {
      href: `/agents/${agent.id}/customization`,
      label: "Customization",
      hint: customization.appearance.theme === "dark" ? "Dark widget" : "Light widget",
      icon: Palette,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-3">
        <MetricCard
          label="Conversations"
          value={overview?.totalConversations ?? 0}
          hint={
            overview?.totalConversations
              ? "All threads for this agent"
              : "No chats yet"
          }
          icon={MessagesSquare}
        />
        <MetricCard
          label="Messages"
          value={overview?.totalMessages ?? 0}
          hint={
            overview?.averageConversationLength
              ? `~${overview.averageConversationLength} per chat`
              : "No messages yet"
          }
          tone="info"
          icon={MessageSquare}
        />
        <MetricCard
          label="Avg response"
          value={formatResponseTime(overview?.averageResponseTimeMs)}
          hint={
            overview?.mostCommonTopic
              ? `Top topic · ${overview.mostCommonTopic}`
              : "After the first reply"
          }
          tone="warning"
          icon={Clock}
        />
      </section>

      <section className="grid gap-2 sm:grid-cols-3">
        {shortcuts.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="hapy-card flex items-center gap-3 px-4 py-3.5 transition-colors hover:border-[var(--color-primary)]/30"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-[var(--color-text)]">
                  {item.label}
                </span>
                <span className="block text-[12px] text-[var(--color-muted)]">
                  {item.hint}
                </span>
              </span>
            </Link>
          );
        })}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="space-y-4">
          <section className="hapy-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-text)]">
                  Setup
                </h2>
                <p className="mt-0.5 text-[12px] text-[var(--color-muted)]">
                  {readyCount} of 4 ready
                </p>
              </div>
              {readyCount === 4 ? (
                <Link
                  href={`/agents/${agent.id}/customization`}
                  className="rounded-full bg-[var(--color-primary)]/10 px-2.5 py-1 text-[11px] font-medium text-[var(--color-primary)]"
                >
                  Ready to deploy
                </Link>
              ) : (
                <span className="rounded-full bg-[var(--color-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-muted)]">
                  In progress
                </span>
              )}
            </div>
            <div className="mt-3 divide-y divide-[var(--color-border)]">
              <SetupRow
                done={hasWelcome}
                label="Welcome message"
                hint="First line visitors see"
                href={`/agents/${agent.id}/edit`}
              />
              <SetupRow
                done={hasPrompt}
                label="System prompt"
                hint="How the agent should answer"
                href={`/agents/${agent.id}/edit`}
              />
              <SetupRow
                done={hasKnowledge}
                label="Knowledge"
                hint={
                  hasKnowledge
                    ? `${knowledgeCount} document${knowledgeCount === 1 ? "" : "s"}`
                    : "Add FAQ text or a PDF"
                }
                href={`/agents/${agent.id}/knowledge`}
              />
              <SetupRow
                done={hasCustomized}
                label="Widget look"
                hint="Identity, colors, embed, features"
                href={`/agents/${agent.id}/customization`}
              />
              <SetupRow
                done={false}
                label="Test in Studio"
                hint="Run greeting and knowledge scripts"
                href={`/agents/${agent.id}/test`}
              />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="hapy-card p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[var(--color-text)]">
                  Welcome message
                </h2>
                <Link
                  href={`/agents/${agent.id}/edit`}
                  className="text-[12px] font-medium text-[var(--color-primary)] hover:underline"
                >
                  Edit
                </Link>
              </div>
              <p className="mt-3 rounded-xl bg-[var(--color-bg)] px-3.5 py-3 text-sm leading-relaxed text-[var(--color-text)]">
                {agent.welcomeMessage || "No welcome message yet."}
              </p>
            </section>
            <section className="hapy-card p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[var(--color-text)]">
                  System prompt
                </h2>
                <Link
                  href={`/agents/${agent.id}/edit`}
                  className="text-[12px] font-medium text-[var(--color-primary)] hover:underline"
                >
                  Edit
                </Link>
              </div>
              <p className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-xl bg-[var(--color-bg)] px-3.5 py-3 text-[13px] leading-relaxed text-[var(--color-text-secondary)]">
                {agent.systemPrompt || "No system prompt yet."}
              </p>
            </section>
          </div>
        </div>

        <div className="space-y-4">
          <section className="hapy-card overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-5 py-4">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">
                Widget
              </h2>
              <Link
                href={`/agents/${agent.id}/customization`}
                className="text-[12px] font-medium text-[var(--color-primary)] hover:underline"
              >
                Customize
              </Link>
            </div>
            <div className="flex items-center gap-3 px-5 py-4">
              {customization.identity.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={customization.identity.avatarUrl}
                  alt=""
                  className="size-11 rounded-full object-cover"
                />
              ) : (
                <span
                  className="flex size-11 items-center justify-center rounded-full text-sm font-semibold text-white"
                  style={{
                    backgroundColor: customization.appearance.primaryColor,
                  }}
                >
                  {(customization.identity.displayName || agent.name)
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((p) => p[0]?.toUpperCase())
                    .join("")}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--color-text)]">
                  {customization.identity.displayName || agent.name}
                </p>
                <p className="truncate text-[12px] text-[var(--color-muted)]">
                  {customization.deploy.chatInterface === "embedded"
                    ? "Embedded chat"
                    : "Floating widget"}{" "}
                  · {customization.appearance.theme} theme
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-px border-t border-[var(--color-border)] bg-[var(--color-border)]">
              <div className="bg-[var(--color-surface)] px-5 py-3">
                <dt className="text-[11px] text-[var(--color-muted)]">Color</dt>
                <dd className="mt-1 flex items-center gap-2 text-[13px] font-medium text-[var(--color-text)]">
                  <span
                    className="size-3 rounded-full ring-1 ring-black/10"
                    style={{
                      backgroundColor: customization.appearance.primaryColor,
                    }}
                  />
                  {customization.appearance.primaryColor}
                </dd>
              </div>
              <div className="bg-[var(--color-surface)] px-5 py-3">
                <dt className="text-[11px] text-[var(--color-muted)]">History</dt>
                <dd className="mt-1 text-[13px] font-medium text-[var(--color-text)]">
                  {customization.features.conversationHistory ? "On" : "Off"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="hapy-card overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-5 py-4">
              <h2 className="text-sm font-semibold text-[var(--color-text)]">
                Recent conversations
              </h2>
              <Link
                href="/conversations"
                className="text-[12px] font-medium text-[var(--color-primary)] hover:underline"
              >
                Inbox
              </Link>
            </div>
            {conversations.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Sparkles className="mx-auto size-5 text-[var(--color-muted)]" />
                <p className="mt-2 text-[13px] text-[var(--color-muted)]">
                  No conversations yet.
                </p>
                <Link
                  href={`/agents/${agent.id}/test`}
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "mt-3 inline-flex gap-1.5"
                  )}
                >
                  Start a test chat
                </Link>
              </div>
            ) : (
              <ul>
                {conversations.slice(0, 5).map((convo) => (
                  <li key={convo.id} className="border-t border-[var(--color-border)] first:border-t-0">
                    <Link
                      href={`/chat?agentId=${agent.id}&conversationId=${convo.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-[var(--color-bg)]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-[var(--color-text)]">
                          {convo.category || "GENERAL"}
                          {convo.sentiment ? ` · ${convo.sentiment}` : ""}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-[var(--color-muted)]">
                          {formatWhen(convo.startedAt || convo.createdAt)}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] text-[var(--color-muted)]">
                        {convo.messageCount || 0} msgs
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="hapy-card flex items-start gap-3 p-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg)] text-[var(--color-muted)]">
              <FileText className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-[var(--color-text)]">
                Knowledge sources
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--color-muted)]">
                {hasKnowledge
                  ? `${knowledgeCount} document${knowledgeCount === 1 ? "" : "s"} attached.`
                  : "Add FAQ text or a PDF so answers stay on-brand."}
              </p>
              <Link
                href={`/agents/${agent.id}/knowledge`}
                className="mt-2 inline-flex text-[12px] font-medium text-[var(--color-primary)] hover:underline"
              >
                {hasKnowledge ? "Manage knowledge" : "Add knowledge"}
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
