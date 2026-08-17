"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  FlaskConical,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Square,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { generateTestQuestions, sendChatMessage } from "@/lib/api/chat";
import { getConversation } from "@/lib/api/conversations";
import { resolveCustomization } from "@/lib/customization/defaults";
import { playNotificationBeep } from "@/lib/customization/theme";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatHistoryPanel } from "@/components/chat/ChatHistoryPanel";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { MessageList } from "@/components/chat/MessageList";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const DEFAULT_SCRIPTS = [
  {
    id: "greet",
    title: "Greeting",
    kind: "greeting",
    prompt: "hello",
    expected: "Short welcome in the knowledge language.",
  },
  {
    id: "about",
    title: "What do you do?",
    kind: "knowledge",
    prompt: "What do you help with?",
    expected: "Stay on knowledge. Do not invent products or prices.",
  },
  {
    id: "price",
    title: "Pricing",
    kind: "pricing",
    prompt: "How much does it cost?",
    expected: "No invented price list.",
  },
  {
    id: "unknown",
    title: "Unknown fact",
    kind: "unknown",
    prompt: "What is your office address?",
    expected: "Refuse if it is not in knowledge.",
  },
];

const MAX_SELF_QUESTIONS = 20;

const MODES = [
  { id: "self", label: "Ask yourself" },
  { id: "pack", label: "Question pack" },
];

function emptySelfQuestion() {
  return {
    id: `q-${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}`,
    prompt: "",
  };
}

function welcomeBubble(agent) {
  if (!agent?.welcomeMessage) return [];
  return [
    {
      id: `welcome-${agent.id}`,
      role: "ASSISTANT",
      content: agent.welcomeMessage,
      responseTime: null,
      local: true,
    },
  ];
}

export function AgentTestStudio({ agent }) {
  const customization = useMemo(() => resolveCustomization(agent), [agent]);
  const [mode, setMode] = useState("self");
  const [questions, setQuestions] = useState(DEFAULT_SCRIPTS);
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState(() => welcomeBubble(agent));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const [lastPrompt, setLastPrompt] = useState("");
  const [selfQuestions, setSelfQuestions] = useState(() => [
    emptySelfQuestion(),
    emptySelfQuestion(),
  ]);
  const [runStatus, setRunStatus] = useState("idle");
  const [runIndex, setRunIndex] = useState(0);
  const [runQueue, setRunQueue] = useState([]);
  const conversationIdRef = useRef(null);
  const sendingRef = useRef(false);
  const runRef = useRef({ status: "idle", index: 0, queue: [] });
  const runActive = runStatus === "running" || runStatus === "paused";

  const resetThread = useCallback(() => {
    runRef.current.status = "stopped";
    setRunStatus((current) =>
      current === "running" || current === "paused" ? "stopped" : current
    );
    conversationIdRef.current = null;
    setConversationId(null);
    setMessages(welcomeBubble(agent));
    setError("");
    setHistoryOpen(false);
    setLastPrompt("");
  }, [agent]);

  async function send(text) {
    const prompt = text.trim();
    if (!agent?.id || sendingRef.current || !prompt) return false;
    sendingRef.current = true;
    setSending(true);
    setError("");
    setLastPrompt(prompt);
    const optimisticId = `local-user-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: optimisticId, role: "USER", content: prompt, local: true },
    ]);

    try {
      const result = await sendChatMessage(agent.id, {
        message: prompt,
        conversationId: conversationIdRef.current || undefined,
      });
      conversationIdRef.current = result.conversationId;
      setConversationId(result.conversationId);
      setMessages((prev) => {
        const withoutOptimistic = prev.filter((m) => m.id !== optimisticId);
        return [
          ...withoutOptimistic,
          {
            id: result.userMessage.id,
            role: result.userMessage.role,
            content: result.userMessage.content,
            createdAt: result.userMessage.createdAt,
          },
          {
            id: result.message.id,
            role: result.message.role,
            content: result.message.content,
            responseTime: result.message.responseTime,
            createdAt: result.message.createdAt,
          },
        ];
      });
      setHistoryKey((k) => k + 1);
      if (customization.features.notificationSound) {
        playNotificationBeep();
      }
      return true;
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setError(err.message || "Unable to send message");
      return false;
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const data = await generateTestQuestions(agent.id, {
        previousPrompts: questions.map((item) => item.prompt),
      });
      setQuestions(data.questions || []);
      setGenerated(true);
      toast.success("New test questions ready");
    } catch (err) {
      toast.error(err.message || "Could not generate questions");
    } finally {
      setGenerating(false);
    }
  }

  function patchQuestion(id, prompt) {
    setQuestions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, prompt } : item))
    );
  }

  function patchSelfQuestion(id, prompt) {
    setSelfQuestions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, prompt } : item))
    );
  }

  function addSelfQuestion() {
    setSelfQuestions((prev) =>
      prev.length >= MAX_SELF_QUESTIONS ? prev : [...prev, emptySelfQuestion()]
    );
  }

  function removeSelfQuestion(id) {
    setSelfQuestions((prev) =>
      prev.length <= 1 ? prev : prev.filter((item) => item.id !== id)
    );
  }

  async function runNextQuestion() {
    if (runRef.current.status !== "running") return;
    const queue = runRef.current.queue;
    const index = runRef.current.index;
    if (index >= queue.length) {
      runRef.current.status = "done";
      setRunStatus("done");
      toast.success(`Test finished · ${queue.length} questions`);
      return;
    }

    setRunIndex(index);
    const ok = await send(queue[index].prompt);
    if (runRef.current.status === "stopped") return;
    if (!ok) {
      runRef.current.status = "paused";
      setRunStatus("paused");
      toast.error("Test paused — fix the error, then resume");
      return;
    }

    const next = index + 1;
    runRef.current.index = next;
    setRunIndex(next);
    if (next >= queue.length) {
      runRef.current.status = "done";
      setRunStatus("done");
      toast.success(`Test finished · ${queue.length} questions`);
      return;
    }
    if (runRef.current.status !== "running") return;
    await runNextQuestion();
  }

  function startSelfTest() {
    if (runRef.current.status === "running") return;
    const queue = selfQuestions
      .map((item) => ({ id: item.id, prompt: item.prompt.trim() }))
      .filter((item) => item.prompt);
    if (queue.length === 0) {
      toast.error("Add at least one question");
      return;
    }
    runRef.current = { status: "running", index: 0, queue };
    setRunQueue(queue);
    setRunIndex(0);
    setRunStatus("running");
    runNextQuestion();
  }

  function pauseSelfTest() {
    if (runRef.current.status !== "running") return;
    runRef.current.status = "paused";
    setRunStatus("paused");
  }

  function resumeSelfTest() {
    if (runRef.current.status !== "paused") return;
    runRef.current.status = "running";
    setRunStatus("running");
    runNextQuestion();
  }

  function stopSelfTest() {
    if (runRef.current.status !== "running" && runRef.current.status !== "paused") {
      return;
    }
    runRef.current.status = "stopped";
    setRunStatus("stopped");
    toast.message("Test stopped");
  }

  function switchMode(next) {
    if (next !== mode && runActive) stopSelfTest();
    setMode(next);
  }

  const chatBody = historyOpen ? (
    <ChatHistoryPanel
      agentId={agent.id}
      activeId={conversationId}
      refreshKey={historyKey}
      onSelect={async (id) => {
        setHistoryOpen(false);
        setConversationId(id);
        conversationIdRef.current = id;
        setError("");
        try {
          const data = await getConversation(id);
          setMessages(
            (data.messages || []).map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              responseTime: m.responseTime,
              createdAt: m.createdAt,
            }))
          );
        } catch (err) {
          setError(err.message || "Unable to open conversation");
        }
      }}
      onNewChat={resetThread}
    />
  ) : (
    <>
      {sending && messages.length === 0 ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
          <Skeleton className="h-14 w-2/3 rounded-2xl bg-[var(--color-border)]" />
        </div>
      ) : (
        <MessageList
          messages={messages}
          loading={sending}
          compact={false}
          themed
          showFeedback={customization.features.messageFeedback}
        />
      )}
      {error ? (
        <p className="mx-3 mb-2 rounded-lg border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-3 py-2 text-[12px] text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
      <ChatComposer
        disabled={sending || runActive}
        onSend={send}
        compact={false}
        themed
        placeholder={
          runActive
            ? "Auto-test running — pause or stop to type"
            : mode === "self"
            ? "Type your own test as a visitor…"
            : customization.identity.messagePlaceholder || "Type a test message…"
        }
        footer={customization.identity.footer || undefined}
        allowFileUpload={customization.features.fileUpload}
      />
    </>
  );

  const panelHeight = "h-[min(640px,72vh)] min-h-[480px]";

  return (
    <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)]">
      <section className={cn("hapy-card flex flex-col overflow-hidden p-5", panelHeight)}>
        <div className="flex shrink-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            <FlaskConical className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              Studio emulator
            </h2>
            <p className="mt-0.5 text-[12px] text-[var(--color-muted)]">
              Test this agent’s prompt, knowledge, and widget look.
            </p>
          </div>
        </div>

        <div className="mt-4 flex shrink-0 justify-start">
          <div className="inline-flex rounded-full bg-[#f1f5f9] p-1">
            {MODES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => switchMode(option.id)}
                className={cn(
                  "rounded-full px-3.5 py-1 text-[12px] font-medium",
                  mode === option.id
                    ? "bg-white text-[var(--color-text)] shadow-sm ring-1 ring-black/5"
                    : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {mode === "self" ? (
          <div className="mt-4 flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
              <p className="text-[12px] text-[var(--color-muted)]">
                Add your questions, then run them one by one.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {runStatus === "running" ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={pauseSelfTest}
                    >
                      <Pause className="size-3.5" />
                      Pause
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-[var(--color-danger)]"
                      onClick={stopSelfTest}
                    >
                      <Square className="size-3.5" />
                      Stop
                    </Button>
                  </>
                ) : runStatus === "paused" ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      className="gap-1.5"
                      onClick={resumeSelfTest}
                      disabled={sending}
                    >
                      {sending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Play className="size-3.5" />
                      )}
                      Resume
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-[var(--color-danger)]"
                      onClick={stopSelfTest}
                    >
                      <Square className="size-3.5" />
                      Stop
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1.5"
                    onClick={startSelfTest}
                    disabled={
                      sending ||
                      !selfQuestions.some((item) => item.prompt.trim())
                    }
                  >
                    <Play className="size-3.5" />
                    Run test
                  </Button>
                )}
              </div>
            </div>

            {runStatus !== "idle" ? (
              <p className="mt-2 shrink-0 text-[12px] text-[var(--color-muted)]">
                {runStatus === "running"
                  ? `Running ${Math.min(runIndex + 1, runQueue.length)} of ${runQueue.length}`
                  : runStatus === "paused"
                    ? `Paused at ${Math.min(runIndex + 1, runQueue.length)} of ${runQueue.length}`
                    : runStatus === "done"
                      ? `Finished ${runQueue.length} of ${runQueue.length}`
                      : `Stopped · ${Math.min(runIndex, runQueue.length)} of ${runQueue.length} sent`}
              </p>
            ) : null}

            <ol className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {selfQuestions.map((item, index) => {
                const queuePos = runQueue.findIndex((row) => row.id === item.id);
                const current =
                  runActive && queuePos === runIndex && queuePos >= 0;
                const done =
                  queuePos >= 0 &&
                  runStatus !== "idle" &&
                  (runStatus === "done" || runIndex > queuePos);
                return (
                  <li
                    key={item.id}
                    className={cn(
                      "rounded-xl border px-3 py-2.5",
                      current
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                        : "border-[var(--color-border)]"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-medium text-[var(--color-text)]">
                        {index + 1}.
                        {current && sending ? (
                          <span className="ml-1.5 text-[11px] font-normal text-[var(--color-primary)]">
                            Sending…
                          </span>
                        ) : done ? (
                          <span className="ml-1.5 text-[11px] font-normal text-[var(--color-muted)]">
                            Sent
                          </span>
                        ) : null}
                      </p>
                      <button
                        type="button"
                        disabled={runActive || selfQuestions.length <= 1}
                        onClick={() => removeSelfQuestion(item.id)}
                        className="rounded-md p-0.5 text-[var(--color-muted)] hover:text-[var(--color-danger)] disabled:opacity-40"
                        aria-label="Remove question"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <textarea
                      value={item.prompt}
                      onChange={(e) => patchSelfQuestion(item.id, e.target.value)}
                      rows={2}
                      disabled={runActive}
                      placeholder={`Question ${index + 1} — e.g. What are your hours?`}
                      className="mt-2 w-full resize-none rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-[12px] text-[var(--color-text)] outline-none focus-visible:border-[var(--color-primary)] disabled:opacity-60"
                    />
                  </li>
                );
              })}
            </ol>

            <button
              type="button"
              onClick={addSelfQuestion}
              disabled={runActive || selfQuestions.length >= MAX_SELF_QUESTIONS}
              className="mt-2 shrink-0 inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--color-primary)] hover:underline disabled:opacity-40"
            >
              <Plus className="size-3.5" />
              Add question
            </button>
          </div>
        ) : (
          <div className="mt-4 flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
              <p className="text-[12px] text-[var(--color-muted)]">
                {generated
                  ? "Built from this agent’s details. Edit any line, then send."
                  : "Starter pack — generate a set from this agent, or edit these."}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleGenerate}
                disabled={generating || sending || runActive}
              >
                {generating ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : generated ? (
                  <RefreshCw className="size-3.5" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                {generating
                  ? "Generating…"
                  : generated
                    ? "Regenerate"
                    : "Generate with AI"}
              </Button>
            </div>

            <ol className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {questions.map((item, index) => (
                <li
                  key={item.id}
                  className="rounded-xl border border-[var(--color-border)] px-3 py-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-medium text-[var(--color-text)]">
                      {index + 1}. {item.title}
                    </p>
                    <button
                      type="button"
                      disabled={sending || runActive || !item.prompt.trim()}
                      onClick={() => send(item.prompt)}
                      className="rounded-md bg-[var(--color-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-muted)] hover:text-[var(--color-primary)] disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>
                  <textarea
                    value={item.prompt}
                    onChange={(e) => patchQuestion(item.id, e.target.value)}
                    rows={2}
                    className="mt-2 w-full resize-none rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 font-mono text-[12px] text-[var(--color-text)] outline-none focus-visible:border-[var(--color-primary)]"
                  />
                  {item.expected ? (
                    <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                      Expect: {item.expected}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="mt-4 shrink-0 border-t border-[var(--color-border)] pt-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={resetThread}
              disabled={sending || runActive}
            >
              <RotateCcw className="size-3.5" />
              New chat
            </Button>
            <Link
              href={`/chat?agentId=${agent.id}${conversationId ? `&conversationId=${conversationId}` : ""}`}
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Open in Chat
            </Link>
          </div>
          {lastPrompt ? (
            <p className="mt-2 truncate text-[11px] text-[var(--color-muted)]">
              Last sent: “{lastPrompt}”
            </p>
          ) : null}
        </div>
      </section>

      <div className={cn("hapy-card overflow-hidden", panelHeight)}>
        <div className="h-full min-h-0">
          <ChatWidget
            agent={agent}
            customization={customization}
            open
            fullPage
            historyOpen={historyOpen}
            onHistoryToggle={() => {
              setHistoryOpen((open) => !open);
              setHistoryKey((k) => k + 1);
            }}
          >
            {chatBody}
          </ChatWidget>
        </div>
      </div>
    </div>
  );
}
