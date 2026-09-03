"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Bell, Check, Globe, Plus, Settings2 } from "lucide-react";

const SCENES = [
  {
    headline: "Smart chatbots tailored to your knowledge and tools.",
    user: "Where is my order #4821?",
    tool: "get_order_status",
    agent: "Order #4821 is out for delivery — arrives tomorrow by 6pm.",
  },
  {
    headline: "Answers grounded in your docs — not inventing policy.",
    user: "What’s your refund window?",
    tool: "knowledge.retrieve",
    agent: "You have 30 days from delivery. I can start a return if you’d like.",
  },
  {
    headline: "Safe actions with confirmations before anything writes.",
    user: "Cancel my subscription please.",
    tool: "confirm → cancel_subscription",
    agent: "Ready to cancel. Tap confirm and I’ll run it now.",
  },
];

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 px-0.5">
      <span className="size-1 animate-pulse rounded-full bg-current opacity-70 [animation-delay:0ms]" />
      <span className="size-1 animate-pulse rounded-full bg-current opacity-70 [animation-delay:150ms]" />
      <span className="size-1 animate-pulse rounded-full bg-current opacity-70 [animation-delay:300ms]" />
    </span>
  );
}

export function FeatureLiveChat() {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [phase, setPhase] = useState("headline"); // headline | typingUser | user | tool | typingAgent | agent | hold
  const [typedUser, setTypedUser] = useState("");

  const scene = SCENES[sceneIndex];

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      setPhase("agent");
      setTypedUser(scene.user);
      const id = window.setInterval(() => {
        setSceneIndex((i) => (i + 1) % SCENES.length);
      }, 4000);
      return () => window.clearInterval(id);
    }

    let timeout;

    if (phase === "headline") {
      timeout = window.setTimeout(() => {
        setTypedUser("");
        setPhase("typingUser");
      }, 1200);
    } else if (phase === "typingUser") {
      if (typedUser.length < scene.user.length) {
        timeout = window.setTimeout(() => {
          setTypedUser(scene.user.slice(0, typedUser.length + 1));
        }, 26);
      } else {
        timeout = window.setTimeout(() => setPhase("user"), 350);
      }
    } else if (phase === "user") {
      timeout = window.setTimeout(() => setPhase("tool"), 500);
    } else if (phase === "tool") {
      timeout = window.setTimeout(() => setPhase("typingAgent"), 900);
    } else if (phase === "typingAgent") {
      timeout = window.setTimeout(() => setPhase("agent"), 900);
    } else if (phase === "agent") {
      timeout = window.setTimeout(() => setPhase("hold"), 2200);
    } else if (phase === "hold") {
      timeout = window.setTimeout(() => {
        setSceneIndex((i) => (i + 1) % SCENES.length);
        setTypedUser("");
        setPhase("headline");
      }, 500);
    }

    return () => {
      if (timeout) window.clearTimeout(timeout);
    };
  }, [phase, typedUser, scene.user, sceneIndex]);

  const showUser =
    phase === "typingUser" ||
    phase === "user" ||
    phase === "tool" ||
    phase === "typingAgent" ||
    phase === "agent" ||
    phase === "hold";
  const showTool = phase === "tool" || phase === "typingAgent" || phase === "agent" || phase === "hold";
  const showTypingAgent = phase === "typingAgent";
  const showAgent = phase === "agent" || phase === "hold";
  const sending = phase === "typingUser" && typedUser.length === scene.user.length;

  return (
    <div className="flex h-[22.5rem] w-full max-w-[19.5rem] flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-[0_22px_50px_-18px_rgba(0,0,0,0.5)] backdrop-blur-md">
      <div className="flex shrink-0 items-center justify-between border-b border-black/[0.06] px-3.5 py-2.5">
        <span className="inline-flex h-5 items-center rounded-full bg-black/[0.05] px-2 py-0.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/aide-logo.png" alt="AIDE" className="h-2.5 w-auto" />
        </span>
        <Globe className="size-3.5 text-[var(--landing-muted)]" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3.5 py-4">
        <p className="shrink-0 text-[13px] font-medium leading-snug text-[var(--landing-ink)] transition-opacity duration-300">
          {scene.headline}
        </p>

        <div
          className="flex min-h-0 flex-1 flex-col justify-end gap-2 overflow-hidden"
          aria-live="polite"
        >
          {showUser ? (
            <div className="shrink-0 rounded-xl bg-[#f5f3f0] px-3 py-2.5 text-[12px] leading-relaxed text-[var(--landing-ink)]">
              <span className="text-[var(--landing-muted)]">Visitor · </span>
              {typedUser}
              {phase === "typingUser" ? (
                <span className="ml-0.5 inline-block h-[1em] w-[1.5px] animate-pulse bg-[var(--color-primary)] align-[-0.1em]" />
              ) : null}
            </div>
          ) : (
            <div className="shrink-0 rounded-xl border border-dashed border-black/[0.08] bg-[#faf9f7] px-3 py-2.5 text-[12px] text-[var(--landing-muted)]">
              Ask anything…
            </div>
          )}

          {showTool ? (
            <div className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border border-black/[0.06] bg-white px-2.5 py-1 text-[10px] font-medium tracking-wide text-[var(--landing-muted)] uppercase">
              <span className="size-1.5 rounded-full bg-[var(--color-primary)]" />
              {scene.tool}
            </div>
          ) : null}

          {showTypingAgent ? (
            <div className="shrink-0 rounded-xl border border-black/[0.05] bg-white px-3 py-2.5 text-[12px] text-[var(--landing-muted)] shadow-sm">
              AIDE <TypingDots />
            </div>
          ) : null}

          {showAgent ? (
            <div className="shrink-0 rounded-xl border border-black/[0.05] bg-white px-3 py-2.5 text-[12px] leading-relaxed text-[var(--landing-ink)] shadow-sm">
              <span className="font-medium text-[var(--color-primary)]">AIDE · </span>
              {scene.agent}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-black/[0.06] px-3 py-2.5">
        <Plus className="size-4 text-[var(--landing-muted)]" />
        <Settings2 className="size-4 text-[var(--landing-muted)]" />
        <Bell className="size-4 text-[var(--landing-muted)]" />
        <span
          className={`ml-auto flex size-7 items-center justify-center rounded-full text-white transition-transform duration-300 ${
            showAgent
              ? "scale-100 bg-[var(--color-primary)]"
              : sending
                ? "scale-95 bg-[var(--landing-ink)]"
                : "bg-[var(--landing-ink)]"
          }`}
        >
          {showAgent ? (
            <Check className="size-3.5" />
          ) : (
            <ArrowUpRight className="size-3.5" />
          )}
        </span>
      </div>
    </div>
  );
}
