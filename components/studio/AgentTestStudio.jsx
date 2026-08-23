"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Download,
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
import { playNotificationBeep, widgetIntro } from "@/lib/customization/theme";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatHistoryPanel } from "@/components/chat/ChatHistoryPanel";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { MessageList } from "@/components/chat/MessageList";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useUrlTab } from "@/hooks/use-url-tab";

const DEFAULT_SCRIPTS = [
  {
    id: "greet",
    title: "Greeting",
    kind: "greeting",
    prompt: "hello",
    expected: "Short welcome in the knowledge language.",
    expectIncludes: "",
  },
  {
    id: "about",
    title: "What do you do?",
    kind: "knowledge",
    prompt: "What do you help with?",
    expected: "Stay on knowledge. Do not invent products or prices.",
    expectIncludes: "",
  },
  {
    id: "price",
    title: "Pricing",
    kind: "pricing",
    prompt: "How much does it cost?",
    expected: "No invented price list.",
    expectIncludes: "",
  },
  {
    id: "unknown",
    title: "Unknown fact",
    kind: "unknown",
    prompt: "What is your office address?",
    expected: "Refuse if it is not in knowledge.",
    expectIncludes: "",
  },
];

/** Hard cap — never parallel-blast OpenAI (F05-E). */
const MAX_SELF_QUESTIONS = 20;
const MAX_RUN_QUESTIONS = 20;

const MODES = [
  { id: "self", label: "Ask yourself" },
  { id: "pack", label: "Question pack" },
];
const MODE_IDS = MODES.map((m) => m.id);

function emptySelfQuestion() {
  return {
    id: `q-${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}`,
    prompt: "",
    expectIncludes: "",
  };
}

function softPassFail(answer, expectIncludes) {
  const needle = String(expectIncludes || "").trim().toLowerCase();
  if (!needle) return null;
  const hay = String(answer || "").toLowerCase();
  return hay.includes(needle) ? "pass" : "fail";
}

function ResultBadge({ status }) {
  if (!status || status === "sent") {
    return (
      <span className="ml-1.5 text-[11px] font-normal text-[var(--color-muted)]">
        Sent
      </span>
    );
  }
  if (status === "pass") {
    return (
      <span className="ml-1.5 rounded bg-[var(--color-success)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-success)]">
        Pass
      </span>
    );
  }
  if (status === "fail") {
    return (
      <span className="ml-1.5 rounded bg-[var(--color-danger)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-danger)]">
        Fail
      </span>
    );
  }
  if (status === "flaky") {
    return (
      <span className="ml-1.5 rounded bg-[var(--color-warning)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-warning)]">
        Flaky
      </span>
    );
  }
  return null;
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

function RunTestButtons({
  runStatus,
  sending,
  onStart,
  startDisabled,
  onPause,
  onResume,
  onStop,
}) {
  if (runStatus === "running") {
    return (
      <>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={onPause}
        >
          <Pause className="size-3.5" />
          Pause
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-[var(--color-danger)]"
          onClick={onStop}
        >
          <Square className="size-3.5" />
          Stop
        </Button>
      </>
    );
  }
  if (runStatus === "paused") {
    return (
      <>
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          onClick={onResume}
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
          onClick={onStop}
        >
          <Square className="size-3.5" />
          Stop
        </Button>
      </>
    );
  }
  return (
    <Button
      type="button"
      size="sm"
      className="gap-1.5"
      onClick={onStart}
      disabled={startDisabled}
    >
      <Play className="size-3.5" />
      Run test
    </Button>
  );
}

export function AgentTestStudio({ agent }) {
  const customization = useMemo(() => resolveCustomization(agent), [agent]);
  const [mode, setMode] = useUrlTab("tab", MODE_IDS, "self");
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
  const [runResults, setRunResults] = useState([]);
  const [pauseReason, setPauseReason] = useState("");
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
    setPauseReason("");
  }, [agent]);

  async function send(text, meta = {}) {
    const prompt = text.trim();
    if (!agent?.id || sendingRef.current || !prompt) {
      return { ok: false, reason: "Nothing to send" };
    }
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
      const usedKnowledge = result.usedKnowledge || [];
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
            usedKnowledge,
          },
        ];
      });
      setHistoryKey((k) => k + 1);
      setSending(false);
      sendingRef.current = false;
      if (customization.features.notificationSound) {
        playNotificationBeep();
      }

      const soft = softPassFail(result.message?.content, meta.expectIncludes);
      if (meta.questionId) {
        setRunResults((prev) => [
          ...prev.filter((row) => row.id !== meta.questionId),
          {
            id: meta.questionId,
            prompt,
            answer: result.message?.content || "",
            responseTime: result.message?.responseTime ?? null,
            usedKnowledge,
            status: result.degraded ? "flaky" : soft || "sent",
            soft,
          },
        ]);
      }

      if (result.degraded) {
        const reason =
          "OpenAI error — marked flaky; remaining questions not sent";
        setError("Generation failed — Try again");
        setPauseReason(reason);
        return { ok: false, reason };
      }
      return { ok: true };
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      const status = err.status;
      const message =
        status === 429
          ? "Rate limited — wait a moment, then resume"
          : err.message || "Unable to send message";
      const reason =
        status === 429
          ? "Rate limit — pause and retry shortly"
          : "Request failed — remaining questions not marked Sent";
      setError(message);
      setPauseReason(reason);
      if (meta.questionId) {
        setRunResults((prev) => [
          ...prev.filter((row) => row.id !== meta.questionId),
          {
            id: meta.questionId,
            prompt,
            answer: "",
            responseTime: null,
            usedKnowledge: [],
            status: "flaky",
            soft: null,
            error: message,
          },
        ]);
      }
      setSending(false);
      sendingRef.current = false;
      return { ok: false, reason: message };
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const data = await generateTestQuestions(agent.id, {
        previousPrompts: questions.map((item) => item.prompt),
      });
      setQuestions(
        (data.questions || []).map((q) => ({
          ...q,
          expectIncludes: q.expectIncludes || "",
        }))
      );
      setGenerated(true);
      toast.success("New test questions ready");
    } catch (err) {
      toast.error(err.message || "Could not generate questions");
    } finally {
      setGenerating(false);
    }
  }

  function patchSelfQuestion(id, partial) {
    setSelfQuestions((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, ...(typeof partial === "string" ? { prompt: partial } : partial) }
          : item
      )
    );
  }

  function patchQuestion(id, partial) {
    setQuestions((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, ...(typeof partial === "string" ? { prompt: partial } : partial) }
          : item
      )
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
      setPauseReason("");
      toast.success(`Test finished · ${queue.length} questions`);
      return;
    }

    setRunIndex(index);
    const item = queue[index];
    const result = await send(item.prompt, {
      questionId: item.id,
      expectIncludes: item.expectIncludes,
    });
    if (runRef.current.status === "stopped") return;
    if (!result.ok) {
      runRef.current.status = "paused";
      setRunStatus("paused");
      toast.error(result.reason || "Test paused — fix the error, then resume");
      return;
    }

    const next = index + 1;
    runRef.current.index = next;
    setRunIndex(next);
    if (next >= queue.length) {
      runRef.current.status = "done";
      setRunStatus("done");
      setPauseReason("");
      toast.success(`Test finished · ${queue.length} questions`);
      return;
    }
    if (runRef.current.status !== "running") return;
    await runNextQuestion();
  }

  function startRun(items) {
    if (runRef.current.status === "running") return;
    const trimmed = items.map((item) => ({
      id: item.id,
      prompt: (item.prompt || "").trim(),
      expectIncludes: item.expectIncludes || "",
      title: item.title || "",
    }));
    const skipped = trimmed.filter((item) => !item.prompt).length;
    let queue = trimmed.filter((item) => item.prompt);
    if (queue.length === 0) {
      toast.error("Add at least one question");
      return;
    }
    if (queue.length > MAX_RUN_QUESTIONS) {
      queue = queue.slice(0, MAX_RUN_QUESTIONS);
      toast.message(`Capped at ${MAX_RUN_QUESTIONS} questions (sequential)`);
    }
    if (skipped > 0) {
      toast.message(`Skipped ${skipped} empty prompt${skipped === 1 ? "" : "s"}`);
    }
    setRunResults([]);
    setPauseReason("");
    runRef.current = { status: "running", index: 0, queue };
    setRunQueue(queue);
    setRunIndex(0);
    setRunStatus("running");
    runNextQuestion();
  }

  function startSelfTest() {
    startRun(selfQuestions);
  }

  function startPackTest() {
    startRun(questions);
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
    setPauseReason("");
    toast.message("Test stopped");
  }

  function switchMode(next) {
    if (next !== mode && runActive) stopSelfTest();
    setMode(next);
  }

  function exportLastRun() {
    if (!runResults.length) {
      toast.error("Run a test first");
      return;
    }
    const payload = {
      agentId: agent.id,
      agentName: agent.name,
      mode,
      exportedAt: new Date().toISOString(),
      pauseReason: pauseReason || null,
      results: runResults.map((row) => ({
        id: row.id,
        prompt: row.prompt,
        answer: row.answer,
        responseTime: row.responseTime,
        usedKnowledge: row.usedKnowledge,
        status: row.status,
        soft: row.soft,
        error: row.error || null,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hapy-test-run-${agent.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported last run");
  }

  function resultStatusFor(questionId) {
    return runResults.find((row) => row.id === questionId)?.status;
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
          intro={widgetIntro(agent, customization)}
          onFeedback={async (messageId, rating) => {
            if (!messageId) return;
            await fetch(`/api/messages/${messageId}/feedback`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rating }),
            });
          }}
        />
      )}
      {agent.enabled === false ? (
        <p className="mx-3 mb-2 rounded-lg border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-3 py-2 text-[12px] text-[var(--color-danger)]">
          This agent is disabled by Hapy admin. Studio chat is off.
        </p>
      ) : error ? (
        <div className="mx-3 mb-2 rounded-lg border border-[var(--color-danger)]/20 bg-[var(--color-danger)]/5 px-3 py-2 text-[12px] text-[var(--color-danger)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>{error}</p>
            {lastPrompt ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={sending || runActive || agent.enabled === false}
                onClick={() => send(lastPrompt)}
              >
                Try again
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      <ChatComposer
        disabled={sending || runActive || agent.enabled === false}
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
        uploadUrl={`/api/agents/${agent.id}/files`}
      />
    </>
  );

  const panelHeight = "h-[min(640px,72vh)] min-h-[480px]";

  function runProgressLine() {
    if (runStatus === "idle") return null;
    const ids = new Set(
      (mode === "self" ? selfQuestions : questions).map((item) => item.id)
    );
    if (!runQueue.some((row) => ids.has(row.id))) return null;
    return (
      <p className="mt-2 shrink-0 text-[12px] text-[var(--color-muted)]">
        {runStatus === "running"
          ? `Running ${Math.min(runIndex + 1, runQueue.length)} of ${runQueue.length}`
          : runStatus === "paused"
            ? `Paused at ${Math.min(runIndex + 1, runQueue.length)} of ${runQueue.length}`
            : runStatus === "done"
              ? `Finished ${runQueue.length} of ${runQueue.length}`
              : `Stopped · ${Math.min(runIndex, runQueue.length)} of ${runQueue.length} sent`}
      </p>
    );
  }

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
              Train → test → deploy: run questions, inspect knowledge used, export
              results.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={exportLastRun}
            disabled={!runResults.length}
          >
            <Download className="size-3.5" />
            Export run
          </Button>
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
                <RunTestButtons
                  runStatus={runStatus}
                  sending={sending}
                  onStart={startSelfTest}
                  onPause={pauseSelfTest}
                  onResume={resumeSelfTest}
                  onStop={stopSelfTest}
                  startDisabled={
                    sending ||
                    !selfQuestions.some((item) => item.prompt.trim())
                  }
                />
              </div>
            </div>

            {runProgressLine()}
            {pauseReason && runStatus === "paused" ? (
              <p className="mt-1 shrink-0 text-[12px] text-[var(--color-warning)]">
                {pauseReason}
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
                  (runStatus === "done" ||
                    runStatus === "stopped" ||
                    runIndex > queuePos);
                const resultStatus = resultStatusFor(item.id);
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
                        ) : done || resultStatus ? (
                          <ResultBadge status={resultStatus || "sent"} />
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
                      onChange={(e) =>
                        patchSelfQuestion(item.id, { prompt: e.target.value })
                      }
                      rows={2}
                      disabled={runActive}
                      placeholder={`Question ${index + 1} — e.g. What are your hours?`}
                      className="mt-2 w-full resize-none rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 text-[12px] text-[var(--color-text)] outline-none focus-visible:border-[var(--color-primary)] disabled:opacity-60"
                    />
                    <input
                      type="text"
                      value={item.expectIncludes || ""}
                      onChange={(e) =>
                        patchSelfQuestion(item.id, {
                          expectIncludes: e.target.value,
                        })
                      }
                      disabled={runActive}
                      placeholder="Optional: expect reply to include…"
                      className="mt-1.5 w-full rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-[11px] text-[var(--color-text)] outline-none focus-visible:border-[var(--color-primary)] disabled:opacity-60"
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
                  ? "Built from this agent’s details. Run the pack, or send one line."
                  : "Starter pack — generate with AI, then run the full test."}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <RunTestButtons
                  runStatus={runStatus}
                  sending={sending}
                  onStart={startPackTest}
                  onPause={pauseSelfTest}
                  onResume={resumeSelfTest}
                  onStop={stopSelfTest}
                  startDisabled={
                    sending ||
                    generating ||
                    !questions.some((item) => item.prompt.trim())
                  }
                />
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
            </div>

            {runProgressLine()}
            {pauseReason && runStatus === "paused" ? (
              <p className="mt-1 shrink-0 text-[12px] text-[var(--color-warning)]">
                {pauseReason}
              </p>
            ) : null}

            <ol className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {questions.map((item, index) => {
                const queuePos = runQueue.findIndex((row) => row.id === item.id);
                const current =
                  runActive && queuePos === runIndex && queuePos >= 0;
                const done =
                  queuePos >= 0 &&
                  runStatus !== "idle" &&
                  (runStatus === "done" ||
                    runStatus === "stopped" ||
                    runIndex > queuePos);
                const resultStatus = resultStatusFor(item.id);
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
                      {index + 1}. {item.title}
                      {current && sending ? (
                        <span className="ml-1.5 text-[11px] font-normal text-[var(--color-primary)]">
                          Sending…
                        </span>
                      ) : done || resultStatus ? (
                        <ResultBadge status={resultStatus || "sent"} />
                      ) : null}
                    </p>
                    <button
                      type="button"
                      disabled={sending || runActive || !item.prompt.trim()}
                      onClick={() =>
                        send(item.prompt, {
                          questionId: item.id,
                          expectIncludes: item.expectIncludes,
                        })
                      }
                      className="rounded-md bg-[var(--color-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-muted)] hover:text-[var(--color-primary)] disabled:opacity-50"
                    >
                      Send
                    </button>
                  </div>
                  <textarea
                    value={item.prompt}
                    onChange={(e) =>
                      patchQuestion(item.id, { prompt: e.target.value })
                    }
                    rows={2}
                    disabled={runActive}
                    className="mt-2 w-full resize-none rounded-lg border border-[var(--color-border)] bg-white px-2.5 py-1.5 font-mono text-[12px] text-[var(--color-text)] outline-none focus-visible:border-[var(--color-primary)] disabled:opacity-60"
                  />
                  {item.expected ? (
                    <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                      Expect: {item.expected}
                    </p>
                  ) : null}
                  <input
                    type="text"
                    value={item.expectIncludes || ""}
                    onChange={(e) =>
                      patchQuestion(item.id, {
                        expectIncludes: e.target.value,
                      })
                    }
                    disabled={runActive}
                    placeholder="Optional: expect reply to include…"
                    className="mt-1.5 w-full rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1 text-[11px] text-[var(--color-text)] outline-none focus-visible:border-[var(--color-primary)] disabled:opacity-60"
                  />
                </li>
                );
              })}
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
            onReset={resetThread}
          >
            {chatBody}
          </ChatWidget>
        </div>
      </div>
    </div>
  );
}
