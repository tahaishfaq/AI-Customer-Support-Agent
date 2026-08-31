"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock,
  ExternalLink,
  FlaskConical,
  Globe,
  MessageSquare,
  MessagesSquare,
  Palette,
  Sparkles,
  ThumbsDown,
  Wrench,
} from "lucide-react";
import {
  isCustomizationTouched,
  resolveCustomization,
} from "@/lib/customization/defaults";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { monogram } from "@/components/conversations/format";
import { cn } from "@/lib/utils";

function formatResponseTime(ms) {
  if (ms == null || ms === 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatWhen(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function StatCard({ label, value, hint, icon: Icon }) {
  return (
    <Card size="sm" className="shadow-none">
      <CardContent className="flex flex-col gap-3 pt-(--card-spacing)">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          {Icon ? (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon />
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="font-heading text-2xl font-semibold tracking-tight tabular-nums">
            {value}
          </p>
          {hint ? (
            <p className="text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function SetupRow({ done, label, hint, href }) {
  return (
    <Button
      variant="ghost"
      render={<Link href={href} />}
      nativeButton={false}
      className="group h-auto w-full justify-start gap-3 rounded-lg px-2 py-2.5 text-left font-normal whitespace-normal focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full transition-colors duration-200",
          done
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground ring-1 ring-border"
        )}
        aria-hidden={!done}
      >
        {done ? (
          <Check className="size-3 animate-checklist-pop" aria-hidden />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">
          {label}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {hint}
        </span>
      </span>
      <ArrowRight className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5" />
    </Button>
  );
}

function ShortcutCard({ href, label, hint, icon: Icon, badge }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            href={href}
            className="group block h-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        }
      >
        <Card
          size="sm"
          className="h-full shadow-none transition-colors group-hover:bg-accent/40 group-hover:ring-primary/20"
        >
          <CardContent className="flex items-center gap-3 py-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm font-semibold">{label}</span>
                {badge != null ? (
                  <Badge variant="secondary" className="rounded-full">
                    {badge}
                  </Badge>
                ) : null}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {hint}
              </span>
            </span>
          </CardContent>
        </Card>
      </TooltipTrigger>
      <TooltipContent side="bottom">{hint}</TooltipContent>
    </Tooltip>
  );
}

export function AgentOverview({
  agent,
  overview,
  knowledgeCount,
  conversations,
  feedback = null,
  actions = [],
}) {
  const customization = useMemo(
    () => resolveCustomization(agent),
    [agent]
  );

  const hasWelcome = Boolean(agent.welcomeMessage?.trim());
  const hasPrompt = Boolean(agent.systemPrompt?.trim());
  const hasKnowledge = knowledgeCount > 0;
  const hasCustomized = isCustomizationTouched(agent.customization);
  const hasTested =
    conversations.length > 0 || (overview?.totalConversations ?? 0) > 0;
  const hasActions = actions.length > 0;

  const setupItems = [
    {
      done: hasWelcome,
      label: "Welcome message",
      hint: "First line visitors see",
      href: `/agents/${agent.id}/edit`,
    },
    {
      done: hasPrompt,
      label: "System prompt",
      hint: "How the agent should answer",
      href: `/agents/${agent.id}/edit`,
    },
    {
      done: hasKnowledge,
      label: "Knowledge",
      hint: hasKnowledge
        ? `${knowledgeCount} document${knowledgeCount === 1 ? "" : "s"}`
        : "Add FAQ text or a PDF",
      href: `/agents/${agent.id}/knowledge`,
    },
    {
      done: hasCustomized,
      label: "Widget look",
      hint: hasCustomized
        ? "Identity, colors, embed, or features saved"
        : "Identity, colors, embed, features",
      href: `/agents/${agent.id}/customization`,
    },
    {
      done: hasTested,
      label: "Test in Studio",
      hint: hasTested
        ? "At least one test or chat has been run"
        : "Run auto-test or send a message",
      href: `/agents/${agent.id}/test`,
    },
  ];

  const readyCount = setupItems.filter((s) => s.done).length;
  const setupTotal = setupItems.length;
  const progressValue = Math.round((readyCount / setupTotal) * 100);
  const setupComplete = readyCount === setupTotal;
  const nextStep = setupItems.find((s) => !s.done);
  const displayName = customization.identity.displayName || agent.name;
  const feedbackReplies = feedback?.replies || [];

  return (
    <div className="flex flex-col gap-6">
      {/* Next action callout */}
      {!setupComplete && nextStep ? (
        <Alert className="bg-accent/50">
          <Sparkles />
          <AlertTitle>Next: {nextStep.label}</AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{nextStep.hint}</span>
            <Button
              size="sm"
              className="rounded-full shrink-0"
              render={<Link href={nextStep.href} />}
              nativeButton={false}
            >
              Continue
              <ArrowRight data-icon="inline-end" />
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {/* Stats */}
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Conversations"
          value={overview?.totalConversations ?? 0}
          hint={
            overview?.totalConversations
              ? "All threads for this agent"
              : "No chats yet"
          }
          icon={MessagesSquare}
        />
        <StatCard
          label="Messages"
          value={overview?.totalMessages ?? 0}
          hint={
            overview?.averageConversationLength
              ? `~${overview.averageConversationLength} per chat`
              : "No messages yet"
          }
          icon={MessageSquare}
        />
        <StatCard
          label="Avg response"
          value={formatResponseTime(overview?.averageResponseTimeMs)}
          hint={
            overview?.mostCommonTopic
              ? `Top topic · ${overview.mostCommonTopic}`
              : "After the first reply"
          }
          icon={Clock}
        />
      </section>

      {/* Shortcuts */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ShortcutCard
          href={`/agents/${agent.id}/knowledge`}
          label="Knowledge"
          hint="Sources the agent can cite"
          badge={knowledgeCount}
          icon={BookOpen}
        />
        <ShortcutCard
          href={`/agents/${agent.id}/test`}
          label="Test"
          hint="Try answers in Studio"
          icon={FlaskConical}
        />
        <ShortcutCard
          href={`/agents/${agent.id}/customization`}
          label="Customization"
          hint={
            customization.appearance.theme === "dark"
              ? "Dark widget theme"
              : "Light widget theme"
          }
          icon={Palette}
        />
        <ShortcutCard
          href={`/agents/${agent.id}/customization`}
          label="Live data"
          hint={hasActions ? "API actions connected" : "Connect APIs"}
          badge={hasActions ? actions.length : undefined}
          icon={Wrench}
        />
      </section>

      <Separator />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="flex flex-col gap-4">
          {/* Setup */}
          <Card className="shadow-none">
            <CardHeader className="border-b">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <CardTitle className="font-heading text-base">Setup</CardTitle>
                  <CardDescription>
                    {readyCount} of {setupTotal} ready
                  </CardDescription>
                </div>
                <CardAction>
                  {setupComplete ? (
                    <Badge className="rounded-full">Ready to deploy</Badge>
                  ) : (
                    <Badge variant="secondary" className="rounded-full">
                      In progress
                    </Badge>
                  )}
                </CardAction>
              </div>
              <Progress value={progressValue} className="mt-3" />
            </CardHeader>
            <CardContent className="flex flex-col gap-0.5 pt-2">
              {setupItems.map((item) => (
                <SetupRow key={item.label} {...item} />
              ))}
            </CardContent>
          </Card>

          {/* Welcome + prompt via Tabs */}
          <Card className="shadow-none">
            <Tabs defaultValue="welcome">
              <CardHeader className="border-b">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="font-heading text-base">
                    Agent voice
                  </CardTitle>
                  <TabsList variant="line">
                    <TabsTrigger value="welcome">Welcome</TabsTrigger>
                    <TabsTrigger value="prompt">System prompt</TabsTrigger>
                  </TabsList>
                </div>
              </CardHeader>
              <CardContent className="pt-(--card-spacing)">
                <TabsContent value="welcome" className="flex flex-col gap-3">
                  <p className="rounded-xl bg-muted/60 px-3.5 py-3 text-sm leading-relaxed">
                    {agent.welcomeMessage || "No welcome message yet."}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-fit rounded-full"
                    render={<Link href={`/agents/${agent.id}/edit`} />}
                    nativeButton={false}
                  >
                    Edit welcome
                  </Button>
                </TabsContent>
                <TabsContent value="prompt" className="flex flex-col gap-3">
                  <ScrollArea className="max-h-48 rounded-xl bg-muted/60">
                    <p className="whitespace-pre-wrap px-3.5 py-3 text-[13px] leading-relaxed text-muted-foreground">
                      {agent.systemPrompt || "No system prompt yet."}
                    </p>
                  </ScrollArea>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-fit rounded-full"
                    render={<Link href={`/agents/${agent.id}/edit`} />}
                    nativeButton={false}
                  >
                    Edit prompt
                  </Button>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          {/* Widget */}
          <Card className="overflow-hidden shadow-none">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm">Widget</CardTitle>
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0"
                  render={<Link href={`/agents/${agent.id}/customization`} />}
                  nativeButton={false}
                >
                  Customize
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex items-center gap-3 py-4">
              <Avatar size="lg">
                {customization.identity.avatarUrl ? (
                  <AvatarImage src={customization.identity.avatarUrl} alt="" />
                ) : null}
                <AvatarFallback
                  className="font-heading text-sm font-semibold text-white"
                  style={{
                    backgroundColor: customization.appearance.primaryColor,
                  }}
                >
                  {monogram(displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex flex-col gap-1">
                <p className="truncate text-sm font-semibold">{displayName}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="rounded-full">
                    {customization.deploy.chatInterface === "embedded"
                      ? "Embedded"
                      : "Floating"}
                  </Badge>
                  <Badge variant="secondary" className="rounded-full">
                    {customization.appearance.theme}
                  </Badge>
                </div>
              </div>
            </CardContent>
            <Separator />
            <div className="grid grid-cols-2">
              <div className="flex flex-col gap-1 px-5 py-3">
                <p className="text-[11px] text-muted-foreground">Color</p>
                <p className="flex items-center gap-2 text-[13px] font-medium">
                  <span
                    className="size-3 rounded-full ring-1 ring-foreground/10"
                    style={{
                      backgroundColor: customization.appearance.primaryColor,
                    }}
                  />
                  {customization.appearance.primaryColor}
                </p>
              </div>
              <div className="flex flex-col gap-1 border-l border-border px-5 py-3">
                <p className="text-[11px] text-muted-foreground">History</p>
                <p className="text-[13px] font-medium">
                  {customization.features.conversationHistory ? "On" : "Off"}
                </p>
              </div>
            </div>
            <CardFooter className="flex-col items-start gap-1.5 border-t bg-transparent">
              <p className="text-[11px] font-medium text-muted-foreground">
                Live website
              </p>
              {agent.siteKnowledgeOrigin ? (
                <a
                  href={agent.siteKnowledgeOrigin}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-full items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
                >
                  <Globe />
                  <span className="truncate">
                    {String(agent.siteKnowledgeOrigin).replace(
                      /^https?:\/\//,
                      ""
                    )}
                  </span>
                  <ExternalLink className="opacity-70" />
                </a>
              ) : (
                <p className="text-[13px] text-muted-foreground">
                  Not embedded yet. Add the snippet on one https site.
                </p>
              )}
            </CardFooter>
          </Card>

          {/* Activity tabs */}
          <Card className="overflow-hidden shadow-none">
            <Tabs defaultValue="conversations">
              <CardHeader className="border-b">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-sm">Activity</CardTitle>
                  <TabsList variant="line">
                    <TabsTrigger value="conversations">
                      Conversations
                    </TabsTrigger>
                    <TabsTrigger value="feedback">Feedback</TabsTrigger>
                  </TabsList>
                </div>
              </CardHeader>

              <TabsContent value="conversations">
                {conversations.length === 0 ? (
                  <div className="p-4">
                    <EmptyState
                      icon={Sparkles}
                      title="No conversations yet"
                      description="Run a test chat to see threads here."
                      className="border-0 bg-transparent py-8"
                      action={
                        <Button
                          size="sm"
                          className="rounded-full"
                          render={
                            <Link href={`/agents/${agent.id}/test`} />
                          }
                          nativeButton={false}
                        >
                          Start a test chat
                        </Button>
                      }
                    />
                  </div>
                ) : (
                  <div className="flex flex-col">
                    <ul className="max-h-72 overflow-y-auto overscroll-contain">
                      {conversations.slice(0, 6).map((convo) => (
                        <li key={convo.id} className="border-b border-border last:border-b-0">
                          <Link
                            href={`/agents/${agent.id}/conversations/${convo.id}`}
                            className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-muted/50"
                          >
                            <span className="min-w-0 flex flex-col gap-0.5">
                              <span className="truncate text-sm font-medium">
                                {convo.category || "GENERAL"}
                                {convo.sentiment
                                  ? ` · ${convo.sentiment}`
                                  : ""}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {formatWhen(
                                  convo.startedAt || convo.createdAt
                                )}
                              </span>
                            </span>
                            <Badge
                              variant="secondary"
                              className="rounded-full shrink-0"
                            >
                              {convo.messageCount || 0}
                            </Badge>
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <div className="relative z-10 shrink-0 border-t border-border bg-card px-5 py-3">
                      <Link
                        href={`/agents/${agent.id}/conversations`}
                        className={cn(
                          buttonVariants({ variant: "link", size: "sm" }),
                          "h-auto p-0"
                        )}
                      >
                        Open inbox
                      </Link>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="feedback">
                {feedbackReplies.length === 0 ? (
                  <div className="p-4">
                    <EmptyState
                      icon={ThumbsDown}
                      title="No downvotes yet"
                      description="Enable message feedback in Customization so visitors can rate answers."
                      className="border-0 bg-transparent py-8"
                      action={
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          render={
                            <Link
                              href={`/agents/${agent.id}/customization`}
                            />
                          }
                          nativeButton={false}
                        >
                          Open customization
                        </Button>
                      }
                    />
                  </div>
                ) : (
                  <>
                    <div className="border-b border-border px-5 py-2.5">
                      <CardDescription>
                        {feedback?.stats?.rated
                          ? `${feedback.stats.helpfulPercent}% helpful · ${feedback.stats.down} to review`
                          : "Recent thumbs-down answers"}
                      </CardDescription>
                    </div>
                    <ul className="max-h-72 overflow-y-auto overscroll-contain">
                      {feedbackReplies.map((item) => (
                        <li
                          key={item.id}
                          className="border-b border-border last:border-b-0"
                        >
                          <Link
                            href={`/agents/${agent.id}/conversations/${item.conversationId}`}
                            className="flex flex-col gap-1 px-5 py-3 hover:bg-muted/50"
                          >
                            {item.userMessage ? (
                              <span className="truncate text-sm font-medium">
                                {item.userMessage}
                              </span>
                            ) : null}
                            <span className="line-clamp-2 text-xs text-muted-foreground">
                              {item.assistantMessage}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {item.reason
                                ? `Reason · ${item.reason}`
                                : `${formatWhen(item.feedbackAt)} · no reason`}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </Card>

          {/* Knowledge strip */}
          <Card size="sm" className="shadow-none">
            <CardContent className="flex items-center gap-3 py-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <BookOpen />
              </span>
              <div className="min-w-0 flex-1 flex flex-col gap-0.5">
                <p className="text-sm font-medium">Knowledge sources</p>
                <p className="text-xs text-muted-foreground">
                  {hasKnowledge
                    ? `${knowledgeCount} document${knowledgeCount === 1 ? "" : "s"} attached.`
                    : "Add FAQ text or a PDF so answers stay on-brand."}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full shrink-0"
                render={<Link href={`/agents/${agent.id}/knowledge`} />}
                nativeButton={false}
              >
                {hasKnowledge ? "Manage" : "Add"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
