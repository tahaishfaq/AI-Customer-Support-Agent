"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LIVE_BEATS = [
  { id: "a1", role: "assistant", text: "Hi! How can I help you today?" },
  { id: "u1", role: "user", text: "What services does Hapy offer?" },
  { id: "a2", role: "assistant", text: "We help with MVP development, AI integration, and support automation." },
];

function LiveSupportPanel() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timers = [];

    function schedule(fn, ms) {
      timers.push(window.setTimeout(fn, ms));
    }

    function runCycle() {
      if (cancelled) return;
      setVisibleCount(0);
      setTyping(false);

      // first assistant
      schedule(() => {
        if (cancelled) return;
        setTyping(true);
      }, 400);
      schedule(() => {
        if (cancelled) return;
        setTyping(false);
        setVisibleCount(1);
      }, 1100);

      // user
      schedule(() => {
        if (cancelled) return;
        setVisibleCount(2);
      }, 2000);

      // second assistant typing + reply
      schedule(() => {
        if (cancelled) return;
        setTyping(true);
      }, 2600);
      schedule(() => {
        if (cancelled) return;
        setTyping(false);
        setVisibleCount(3);
      }, 3800);

      // loop
      schedule(runCycle, 7000);
    }

    runCycle();
    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const shown = LIVE_BEATS.slice(0, visibleCount);

  return (
    <div className="relative mx-auto w-full max-w-[400px] lg:mx-0 lg:max-w-none">
      <div
        className="pointer-events-none absolute -inset-6 rounded-full opacity-55 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--color-primary) 32%, transparent), transparent 70%)",
        }}
      />

      <div className="relative overflow-hidden rounded-[1.25rem] border border-white/70 bg-white/85 shadow-[0_28px_70px_-22px_rgba(11,95,88,0.45)] backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-[var(--color-border)]/80 bg-white/95 px-3.5 py-2">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#f87171]" />
            <span className="size-2 rounded-full bg-[#fbbf24]" />
            <span className="size-2 rounded-full bg-[#34d399]" />
          </div>
          <span className="text-[11px] font-semibold tracking-wide text-[var(--color-primary)]">
            Live support
          </span>
        </div>

        <div
          className="relative px-3.5 py-3.5 sm:px-4 sm:py-4"
          style={{
            background:
              "linear-gradient(165deg, #dcecea 0%, #eef4f3 45%, #f7faf9 100%)",
          }}
        >
          <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-[0_18px_44px_-14px_rgba(15,23,42,0.35)]">
            <div className="flex items-center gap-2.5 bg-[var(--color-primary)] px-3 py-2.5 text-white">
              <span className="flex size-8 items-center justify-center rounded-full bg-white/15 text-[11px] font-semibold">
                HS
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">
                  Hapy Support
                </p>
                <p className="flex items-center gap-1.5 text-[10px] text-white/85">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-300" />
                  Online
                </p>
              </div>
              <span className="rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-medium">
                History
              </span>
            </div>

            <div className="flex min-h-[240px] flex-col justify-end gap-2.5 bg-[#f8fafc] px-3 py-3.5">
              {shown.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "animate-[page-in_0.35s_ease-out_both] text-[12px] leading-relaxed",
                    msg.role === "user"
                      ? "ml-auto max-w-[84%] rounded-2xl rounded-br-md bg-[var(--color-primary)] px-3 py-2 text-white"
                      : "max-w-[90%] rounded-2xl rounded-bl-md border border-[var(--color-border)] bg-white px-3 py-2 text-[var(--color-text)]"
                  )}
                >
                  {msg.text}
                </div>
              ))}

              {typing ? (
                <div className="inline-flex w-fit items-center gap-1 rounded-2xl rounded-bl-md border border-[var(--color-border)] bg-white px-3 py-2.5">
                  <span className="size-1.5 animate-pulse rounded-full bg-[var(--color-muted)]" />
                  <span className="size-1.5 animate-pulse rounded-full bg-[var(--color-muted)] [animation-delay:150ms]" />
                  <span className="size-1.5 animate-pulse rounded-full bg-[var(--color-muted)] [animation-delay:300ms]" />
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2 border-t border-[var(--color-border)] bg-white px-3 py-2">
              <div className="h-8 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-[11px] leading-8 text-[var(--color-muted)]">
                Type a message…
              </div>
              <div className="flex size-8 items-center justify-center rounded-full bg-[var(--color-primary)] text-white">
                <ArrowRight className="size-3.5" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingHero() {
  return (
    <section className="relative z-0 flex min-h-[78dvh] w-full shrink-0 items-center overflow-x-hidden pt-16">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 10% 0%, color-mix(in srgb, var(--color-primary) 28%, white), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 20%, color-mix(in srgb, var(--color-primary) 18%, transparent), transparent 60%), linear-gradient(180deg, #d9ebe8 0%, #eaf3f2 55%, #f3f6f7 100%)",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.2]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, color-mix(in srgb, var(--color-primary) 22%, transparent) 1px, transparent 0)",
          backgroundSize: "32px 32px",
          maskImage:
            "linear-gradient(180deg, black 0%, black 55%, transparent 100%)",
        }}
      />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-8 px-6 py-10 sm:px-8 sm:py-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
        <div>
          <p className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--color-primary)] sm:text-[2.75rem]">
            Hapy
          </p>
          <h1 className="mt-3 max-w-xl font-[family-name:var(--font-display)] text-[1.85rem] font-semibold leading-[1.15] tracking-tight text-[var(--color-text)] sm:text-4xl">
            The AI-native customer support workspace.
          </h1>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[var(--color-text-secondary)] sm:text-base">
            Build agents on your knowledge, chat with customers, and turn every
            conversation into clear insights.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/register"
              className={cn(
                buttonVariants({ size: "lg" }),
                "min-w-[150px] gap-1.5 px-5"
              )}
            >
              Get started
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/login"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "min-w-[150px] border-white/80 bg-white/70 px-5 backdrop-blur hover:bg-white"
              )}
            >
              Sign in
            </Link>
          </div>
          <p className="mt-5 text-[12px] text-[var(--color-muted)]">
            Agents · Knowledge · Chat history · Insights
          </p>
        </div>

        <div aria-hidden>
          <LiveSupportPanel />
        </div>
      </div>
    </section>
  );
}
