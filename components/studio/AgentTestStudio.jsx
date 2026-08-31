"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Download,
  FlaskConical,
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
import { generateTestQuestions, sendChatMessage, resumeChatAfterConfirmation } from "@/lib/api/chat";
import { mergeAssistantReply } from "@/lib/chat/merge-assistant-reply";
import { resolveConversationConfirmation } from "@/lib/api/confirmations";
import { getConversation } from "@/lib/api/conversations";
import { resolveCustomization } from "@/lib/customization/defaults";
import { welcomeBubble } from "@/lib/chat/welcome-bubble";
import { playNotificationBeep, widgetIntro } from "@/lib/customization/theme";
import { useMinWidth } from "@/hooks/use-mobile";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatHistoryPanel } from "@/components/chat/ChatHistoryPanel";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { MessageList } from "@/components/chat/MessageList";
import {
  StudioActionLogs,
  buildSessionLogEntries,
} from "@/components/studio/StudioActionLogs";
import { StudioLogDetail } from "@/components/studio/StudioLogDetail";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
  { id: "logs", label: "Logs" },
];
const MODE_IDS = MODES.map((m) => m.id);

const STUDIO_LAYOUT_TRANSITION = {
  type: "tween",
  duration: 0.32,
  ease: [0.22, 1, 0.36, 1],
};

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
      <Badge variant="outline" className="ml-1.5 rounded-full text-[10px]">
        Sent
      </Badge>
    );
  }
  if (status === "pass") {
    return (
      <Badge className="ml-1.5 rounded-full bg-emerald-500/15 text-[10px] text-emerald-700 hover:bg-emerald-500/15">
        Pass
      </Badge>
    );
  }
  if (status === "fail") {
    return (
      <Badge variant="destructive" className="ml-1.5 rounded-full text-[10px]">
        Fail
      </Badge>
    );
  }
  if (status === "flaky") {
    return (
      <Badge
        variant="outline"
        className="ml-1.5 rounded-full border-amber-500/40 text-[10px] text-amber-700"
      >
        Flaky
      </Badge>
    );
  }
  return null;
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
          onClick={onPause}
        >
          <Pause data-icon="inline-start" />
          Pause
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-destructive"
          onClick={onStop}
        >
          <Square data-icon="inline-start" />
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
          onClick={onResume}
          disabled={sending}
        >
          {sending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Play data-icon="inline-start" />
          )}
          Resume
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-destructive"
          onClick={onStop}
        >
          <Square data-icon="inline-start" />
          Stop
        </Button>
      </>
    );
  }
  return (
    <Button
      type="button"
      size="sm"
      onClick={onStart}
      disabled={startDisabled}
    >
      <Play data-icon="inline-start" />
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
  const [chatExtras, setChatExtras] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const isWideLayout = useMinWidth(1280);
  const conversationIdRef = useRef(null);
  const sendingRef = useRef(false);
  const runRef = useRef({ status: "idle", index: 0, queue: [] });
  const runActive = runStatus === "running" || runStatus === "paused";
  const sessionLogEntries = useMemo(
    () => buildSessionLogEntries(messages, chatExtras),
    [messages, chatExtras]
  );

  useEffect(() => {
    if (mode !== "logs") {
      setSelectedLog(null);
    }
  }, [mode]);

  const logsWideLayout = mode === "logs" && isWideLayout;
  const detailOpen = logsWideLayout && !!selectedLog;

  function openLogDetail(payload) {
    setSelectedLog(payload);
  }

  function closeLogDetail() {
    setSelectedLog(null);
  }

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
    setChatExtras([]);
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
      const toolSteps = result.toolSteps || [];
      const pendingConfirmations = result.pendingConfirmations || [];
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
            toolSteps,
            pendingConfirmations,
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
        setChatExtras((prev) => [
          ...prev,
          {
            id: `chat-deg-${Date.now()}`,
            kind: "chat",
            status: "DEGRADED",
            degraded: true,
            at: new Date().toISOString(),
            message: reason,
          },
        ]);
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
      setChatExtras((prev) => [
        ...prev,
        {
          id: `chat-err-${Date.now()}`,
          kind: "chat_error",
          status: status === 429 ? "RATE_LIMIT" : "ERROR",
          errorCode: status ? `HTTP_${status}` : "CHAT_FAILED",
          message,
          at: new Date().toISOString(),
        },
      ]);
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

  async function handleConfirmDecision(confirmation, decision) {
    const cid =
      confirmation.conversationId ||
      conversationIdRef.current ||
      conversationId;
    if (!cid || !confirmation?.id) {
      throw new Error("Missing conversation");
    }
    const updated = await resolveConversationConfirmation(
      cid,
      confirmation.id,
      decision
    );
    setMessages((prev) =>
      prev.map((m) => ({
        ...m,
        pendingConfirmations: (m.pendingConfirmations || []).map((c) =>
          c.id === confirmation.id
            ? {
                ...c,
                status:
                  updated.status ||
                  (decision === "deny" ? "DENIED" : "APPROVED"),
              }
            : c
        ),
      }))
    );
    if (decision === "approve") {
      sendingRef.current = true;
      setSending(true);
      setError("");
      try {
        const result = await resumeChatAfterConfirmation(agent.id, {
          conversationId: cid,
          confirmationId: confirmation.id,
        });
        conversationIdRef.current = result.conversationId;
        setConversationId(result.conversationId);
        setMessages((prev) => mergeAssistantReply(prev, result));
        setHistoryKey((k) => k + 1);
        if (customization.features.notificationSound && result.message) {
          playNotificationBeep();
        }
        if (result.degraded) {
          setError("Generation failed — Try again");
        }
      } catch (err) {
        setError(err.message || "Unable to continue after approval");
        throw err;
      } finally {
        setSending(false);
        sendingRef.current = false;
      }
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
    a.download = `aide-test-run-${agent.id.slice(0, 8)}.json`;
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
          <Skeleton className="h-14 w-2/3 rounded-2xl" />
        </div>
      ) : (
        <MessageList
          messages={messages}
          loading={sending}
          compact={false}
          themed
          showFeedback={customization.features.messageFeedback}
          intro={widgetIntro(agent, customization)}
          onConfirmDecision={handleConfirmDecision}
          confirmBusy={sending}
          onFeedback={async (messageId, rating, reason) => {
            if (!messageId) return;
            await fetch(`/api/messages/${messageId}/feedback`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                rating,
                ...(reason ? { reason } : {}),
              }),
            });
          }}
        />
      )}
      {agent.enabled === false ? (
        <Alert variant="destructive" className="mx-3 mb-2">
          <AlertDescription>
            This agent is disabled by Aide admin. Studio chat is off.
          </AlertDescription>
        </Alert>
      ) : error ? (
        <Alert variant="destructive" className="mx-3 mb-2">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{error}</span>
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
          </AlertDescription>
        </Alert>
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

  const suggestedPills = useMemo(() => {
    let source = [];
    if (mode === "self") {
      source = selfQuestions.filter((item) => (item.prompt || "").trim());
    } else {
      source = questions.filter((item) => (item.prompt || "").trim());
    }
    if (!source.length) source = DEFAULT_SCRIPTS;
    return source.slice(0, 6);
  }, [mode, selfQuestions, questions]);

  function runProgressLine() {
    if (runStatus === "idle") return null;
    const ids = new Set(
      (mode === "self" ? selfQuestions : questions).map((item) => item.id)
    );
    if (!runQueue.some((row) => ids.has(row.id))) return null;
    return (
      <p className="mt-2 shrink-0 text-xs text-muted-foreground">
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
    <div
      className={cn(
        "flex w-full items-stretch",
        isWideLayout ? "" : "flex-col gap-4"
      )}
    >
      <div
        className={cn("min-w-0", !isWideLayout ? "w-full" : "flex-1 basis-0")}
        style={isWideLayout ? { marginRight: 16 } : undefined}
      >
      <Card
        className={cn(
          "flex min-w-0 flex-col overflow-hidden shadow-none",
          panelHeight
        )}
      >
        <CardHeader className="shrink-0 border-b pb-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FlaskConical className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-sm">Studio emulator</CardTitle>
              <CardDescription className="text-xs">
                {mode === "logs"
                  ? "Developer view: tool calls, knowledge retrieval, and why a request was not consumed."
                  : "Train → test → deploy: run questions, inspect knowledge used, export results."}
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={exportLastRun}
              disabled={!runResults.length}
            >
              <Download data-icon="inline-start" />
              Export run
            </Button>
          </div>

          <ToggleGroup
            value={[mode]}
            onValueChange={(next) => {
              if (next?.[0]) switchMode(next[0]);
            }}
            variant="outline"
            size="sm"
            spacing={0}
            className="mt-3"
            aria-label="Test mode"
          >
            {MODES.map((option) => (
              <ToggleGroupItem
                key={option.id}
                value={option.id}
                className="rounded-full px-3.5"
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col pt-4">
          {mode === "self" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
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
                <p className="mt-1 shrink-0 text-xs text-amber-700">
                  {pauseReason}
                </p>
              ) : null}

              <ScrollArea className="mt-3 min-h-0 flex-1">
                <ol className="flex flex-col gap-2 pr-3">
                  {selfQuestions.map((item, index) => {
                    const queuePos = runQueue.findIndex(
                      (row) => row.id === item.id
                    );
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
                            ? "border-primary bg-primary/5"
                            : "border-border"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {index + 1}.
                            {current && sending ? (
                              <span className="ml-1.5 text-[11px] font-normal text-primary">
                                Sending…
                              </span>
                            ) : done || resultStatus ? (
                              <ResultBadge status={resultStatus || "sent"} />
                            ) : null}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={runActive || selfQuestions.length <= 1}
                            onClick={() => removeSelfQuestion(item.id)}
                            aria-label="Remove question"
                          >
                            <X />
                          </Button>
                        </div>
                        <Textarea
                          value={item.prompt}
                          onChange={(e) =>
                            patchSelfQuestion(item.id, {
                              prompt: e.target.value,
                            })
                          }
                          rows={2}
                          disabled={runActive}
                          placeholder={`Question ${index + 1} — e.g. What are your hours?`}
                          className="mt-2 min-h-[56px] resize-none text-xs"
                        />
                        <Input
                          type="text"
                          value={item.expectIncludes || ""}
                          onChange={(e) =>
                            patchSelfQuestion(item.id, {
                              expectIncludes: e.target.value,
                            })
                          }
                          disabled={runActive}
                          placeholder="Optional: expect reply to include…"
                          className="mt-1.5 h-8 border-dashed text-[11px]"
                        />
                      </li>
                    );
                  })}
                </ol>
              </ScrollArea>

              <Button
                type="button"
                variant="link"
                size="sm"
                className="mt-2 h-auto shrink-0 justify-start px-0"
                onClick={addSelfQuestion}
                disabled={
                  runActive || selfQuestions.length >= MAX_SELF_QUESTIONS
                }
              >
                <Plus data-icon="inline-start" />
                Add question
              </Button>
            </div>
          ) : mode === "pack" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {generated
                    ? "Built from this agent’s details. Run the pack, or tap a suggested pill."
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
                    onClick={handleGenerate}
                    disabled={generating || sending || runActive}
                  >
                    {generating ? (
                      <Spinner data-icon="inline-start" />
                    ) : generated ? (
                      <RefreshCw data-icon="inline-start" />
                    ) : (
                      <Sparkles data-icon="inline-start" />
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
                <p className="mt-1 shrink-0 text-xs text-amber-700">
                  {pauseReason}
                </p>
              ) : null}

              <ScrollArea className="mt-3 min-h-0 flex-1">
                <ol className="flex flex-col gap-2 pr-3">
                  {questions.map((item, index) => {
                    const queuePos = runQueue.findIndex(
                      (row) => row.id === item.id
                    );
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
                            ? "border-primary bg-primary/5"
                            : "border-border"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {index + 1}. {item.title}
                            {current && sending ? (
                              <span className="ml-1.5 text-[11px] font-normal text-primary">
                                Sending…
                              </span>
                            ) : done || resultStatus ? (
                              <ResultBadge status={resultStatus || "sent"} />
                            ) : null}
                          </p>
                          <Button
                            type="button"
                            variant="secondary"
                            size="xs"
                            disabled={
                              sending || runActive || !item.prompt.trim()
                            }
                            onClick={() =>
                              send(item.prompt, {
                                questionId: item.id,
                                expectIncludes: item.expectIncludes,
                              })
                            }
                          >
                            Send
                          </Button>
                        </div>
                        <Textarea
                          value={item.prompt}
                          onChange={(e) =>
                            patchQuestion(item.id, {
                              prompt: e.target.value,
                            })
                          }
                          rows={2}
                          disabled={runActive}
                          className="mt-2 min-h-[56px] resize-none font-mono text-xs"
                        />
                        {item.expected ? (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Expect: {item.expected}
                          </p>
                        ) : null}
                        <Input
                          type="text"
                          value={item.expectIncludes || ""}
                          onChange={(e) =>
                            patchQuestion(item.id, {
                              expectIncludes: e.target.value,
                            })
                          }
                          disabled={runActive}
                          placeholder="Optional: expect reply to include…"
                          className="mt-1.5 h-8 border-dashed text-[11px]"
                        />
                      </li>
                    );
                  })}
                </ol>
              </ScrollArea>
            </div>
          ) : (
            <StudioActionLogs
              agentId={agent.id}
              conversationId={conversationId}
              sessionEntries={sessionLogEntries}
              selectedLogId={selectedLog?.id}
              onSelectLog={(payload) => {
                if (selectedLog?.id === payload.id) {
                  closeLogDetail();
                } else {
                  openLogDetail(payload);
                }
              }}
            />
          )}

          <div className="mt-4 shrink-0 border-t border-border pt-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetThread}
                disabled={sending || runActive}
              >
                <RotateCcw data-icon="inline-start" />
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
              <p className="mt-2 truncate text-[11px] text-muted-foreground">
                Last sent: “{lastPrompt}”
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
      </div>

      {logsWideLayout ? (
        <motion.div
          className="shrink-0 overflow-hidden"
          initial={false}
          animate={{
            width: detailOpen ? "33.333%" : 0,
            marginRight: detailOpen ? 16 : 0,
            opacity: detailOpen ? 1 : 0,
          }}
          transition={STUDIO_LAYOUT_TRANSITION}
          style={{
            pointerEvents: detailOpen ? "auto" : "none",
          }}
        >
          {selectedLog ? (
            <div className={cn("h-full w-full", panelHeight)}>
              <motion.div
                key={selectedLog.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15, ease: STUDIO_LAYOUT_TRANSITION.ease }}
                className="h-full"
              >
                <StudioLogDetail
                  entry={{ ...selectedLog.entry, issue: selectedLog.issue }}
                  source={selectedLog.source}
                  onClose={closeLogDetail}
                />
              </motion.div>
            </div>
          ) : null}
        </motion.div>
      ) : null}

      {mode === "logs" && !isWideLayout && selectedLog ? (
        <motion.div
          key={selectedLog.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, ease: STUDIO_LAYOUT_TRANSITION.ease }}
          className={panelHeight}
        >
          <StudioLogDetail
            entry={{ ...selectedLog.entry, issue: selectedLog.issue }}
            source={selectedLog.source}
            onClose={closeLogDetail}
          />
        </motion.div>
      ) : null}

      <div
        className={cn(
          "flex min-h-0 min-w-0 flex-col gap-3",
          panelHeight,
          isWideLayout ? "flex-1 basis-0" : "w-full"
        )}
      >
        <div className="flex min-h-9 shrink-0 flex-wrap items-center gap-1.5">
          {suggestedPills.map((item) => (
            <Button
              key={item.id}
              type="button"
              variant="outline"
              size="sm"
              className="max-w-full rounded-full"
              disabled={sending || runActive || agent.enabled === false}
              onClick={() =>
                send(item.prompt, {
                  questionId: item.id,
                  expectIncludes: item.expectIncludes,
                })
              }
            >
              <span className="truncate">{item.title || item.prompt}</span>
            </Button>
          ))}
        </div>
        <Card className="min-h-0 flex-1 gap-0 overflow-hidden p-0 py-0 shadow-none ring-1 ring-border [--card-spacing:0px]">
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
        </Card>
      </div>
    </div>
  );
}
