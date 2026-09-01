"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Mic, Plus, Settings2, Star } from "lucide-react";
import { LandingReveal } from "@/components/landing/LandingReveal";

const LOGOS = [
  "Northline",
  "Cascade",
  "Orbit",
  "PeakForm",
  "Lumen",
  "Harbor",
  "Summit",
  "Vertex",
];

const ROTATING_LINES = [
  "Build your AI assistant with confidence",
  "Answer customers from your knowledge base",
  "Run allowlisted tools on every request",
  "Confirm write actions before they run",
  "Hand off to humans with full context",
  "Track sentiment, topics, and reply time",
  "Test in Studio before you embed",
];

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1600&q=80";

function RotatingPrompt() {
  const [lineIndex, setLineIndex] = useState(0);
  const [display, setDisplay] = useState("");
  const [phase, setPhase] = useState("typing"); // typing | pause | deleting

  useEffect(() => {
    const full = ROTATING_LINES[lineIndex];
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      setDisplay(full);
      const id = window.setInterval(() => {
        setLineIndex((i) => (i + 1) % ROTATING_LINES.length);
      }, 3500);
      return () => window.clearInterval(id);
    }

    let timeout;

    if (phase === "typing") {
      if (display.length < full.length) {
        timeout = window.setTimeout(() => {
          setDisplay(full.slice(0, display.length + 1));
        }, 28);
      } else {
        timeout = window.setTimeout(() => setPhase("pause"), 1600);
      }
    } else if (phase === "pause") {
      timeout = window.setTimeout(() => setPhase("deleting"), 400);
    } else if (phase === "deleting") {
      if (display.length > 0) {
        timeout = window.setTimeout(() => {
          setDisplay(display.slice(0, -1));
        }, 16);
      } else {
        setLineIndex((i) => (i + 1) % ROTATING_LINES.length);
        setPhase("typing");
      }
    }

    return () => {
      if (timeout) window.clearTimeout(timeout);
    };
  }, [display, phase, lineIndex]);

  return (
    <p className="min-h-[1.5em] text-[15px] font-medium tracking-tight text-[var(--landing-ink)] sm:text-base">
      <span className="mr-0.5 inline-block h-[1.1em] w-[2px] animate-pulse bg-[var(--color-primary)] align-[-0.1em]" />
      {display}
      <span className="sr-only">{ROTATING_LINES[lineIndex]}</span>
    </p>
  );
}

function LogoCarousel() {
  const loop = [...LOGOS, ...LOGOS];

  return (
    <div className="mx-auto mt-14 max-w-6xl text-center sm:mt-16">
      <p className="text-[12px] font-medium tracking-[0.14em] text-[var(--landing-muted)] uppercase">
        [ 1000+ Trusted Clients ]
      </p>
      <div className="relative mt-6 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-white to-transparent sm:w-20"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-white to-transparent sm:w-20"
        />
        <div className="landing-logo-marquee flex w-max items-center gap-3 sm:gap-3.5">
          {loop.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="flex h-[3.25rem] w-[9.5rem] shrink-0 items-center justify-center rounded-xl border border-dashed border-black/[0.12] bg-[#f7f6f4] text-[13px] font-semibold tracking-tight text-[var(--landing-muted)] sm:w-[10.5rem]"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LandingHero() {
  return (
    <section className="relative overflow-x-hidden bg-white px-6 pb-16 pt-28 sm:px-8 sm:pb-20 sm:pt-32">
      <div className="landing-hero-stage relative mx-auto max-w-6xl">
        <div
          aria-hidden
          className="landing-hero-stage-glow pointer-events-none absolute inset-0 overflow-visible"
        >
          <span className="landing-hero-orb landing-hero-orb-copy" />
        </div>

        <div className="relative z-10 mx-auto max-w-[46rem] text-center">
        <div className="landing-fade-up inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/80 px-3.5 py-1.5 backdrop-blur-sm">
          <span
            aria-hidden
            className="h-3 w-1 rounded-full"
            style={{
              background:
                "linear-gradient(180deg, var(--color-primary) 0%, #f59e0b 45%, #22c55e 100%)",
            }}
          />
          <span className="text-[11px] font-semibold tracking-[0.14em] text-[var(--landing-ink)] uppercase">
            AI Agent Platform
          </span>
        </div>

        <h1 className="landing-fade-up-delay landing-display mt-7 text-[2.35rem] leading-[1.12] text-[var(--landing-ink)] sm:text-5xl md:text-[3.65rem] md:leading-[1.08]">
          Deploy AI agents that work for you, 24/7.
        </h1>

        <p className="landing-fade-up-delay-2 mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-[var(--landing-muted)] sm:text-base">
          Aide helps teams build chatbots, support agents, and workflow
          automations — all in one intelligent platform.
        </p>

        <div className="landing-fade-up-delay-2 mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5">
          <Link
            href="/register"
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[var(--landing-ink)] px-6 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Get started
            <ArrowUpRight className="size-4" />
          </Link>
          <a
            href="#plans"
            className="inline-flex h-11 items-center gap-1.5 text-sm font-medium text-[var(--landing-ink)] transition-opacity hover:opacity-70"
          >
            Talk to sales
            <ArrowUpRight className="size-4" />
          </a>
        </div>
        </div>

      <LandingReveal className="relative z-10 mx-auto mt-12 grid max-w-6xl gap-4 lg:mt-14 lg:grid-cols-[1.65fr_1fr]">
        <div className="relative min-h-[300px] overflow-hidden rounded-[1.35rem] sm:min-h-[340px]">
          <img
            src={HERO_IMAGE}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/10" />

          <div className="absolute inset-x-4 bottom-4 top-auto sm:inset-x-6 sm:bottom-6 sm:top-[18%]">
            <div className="mx-auto flex h-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/95 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.45)] backdrop-blur-md">
              <div className="flex items-center gap-2 border-b border-black/[0.06] px-4 py-3">
                <span className="rounded-full bg-black/[0.05] px-2.5 py-0.5 text-[11px] font-medium text-[var(--landing-muted)]">
                  Aide
                </span>
                <span className="h-px flex-1 bg-black/[0.06]" />
              </div>
              <div className="flex flex-1 items-center px-4 py-6 sm:px-5">
                <RotatingPrompt />
              </div>
              <div className="flex items-center gap-2 border-t border-black/[0.06] px-3 py-2.5">
                <span className="flex size-8 items-center justify-center text-[var(--landing-muted)]">
                  <Plus className="size-4" />
                </span>
                <span className="flex size-8 items-center justify-center text-[var(--landing-muted)]">
                  <Settings2 className="size-4" />
                </span>
                <div className="h-8 flex-1 rounded-full border border-black/[0.08] bg-white px-3 text-[11px] leading-8 text-[var(--landing-muted)]">
                  Ask anything…
                </div>
                <span className="flex size-8 items-center justify-center text-[var(--landing-muted)]">
                  <Mic className="size-4" />
                </span>
                <span className="flex size-8 items-center justify-center rounded-full bg-[var(--landing-ink)] text-white">
                  <ArrowUpRight className="size-3.5" />
                </span>
              </div>
            </div>
          </div>
        </div>

        <aside className="flex min-h-[300px] flex-col justify-between rounded-[1.35rem] bg-[#f3f1ee] p-6 sm:min-h-[340px] sm:p-7">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.12em] text-[var(--landing-muted)] uppercase">
              4.9
              <Star className="size-3 fill-[var(--landing-ink)] text-[var(--landing-ink)]" />
              Rating
            </div>
            <blockquote className="landing-display mt-8 text-[1.35rem] leading-[1.3] text-[var(--landing-ink)] sm:text-[1.5rem]">
              “Aide replaced our automation workflows and gave our team
              real-time visibility across every customer touch.”
            </blockquote>
          </div>
          <div className="mt-10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-semibold text-white">
                MA
              </span>
              <div>
                <p className="text-sm font-semibold text-[var(--landing-ink)]">
                  Mateo Alvarez
                </p>
                <p className="text-[11px] font-medium tracking-[0.1em] text-[var(--landing-muted)] uppercase">
                  Head of Growth
                </p>
              </div>
            </div>
            <span
              aria-hidden
              className="text-[13px] font-semibold text-[var(--landing-muted)]"
            >
              𝕏
            </span>
          </div>
        </aside>
      </LandingReveal>
      </div>

      <LandingReveal delay={50}>
      <div className="relative">
        <LogoCarousel />
      </div>
      </LandingReveal>
    </section>
  );
}
