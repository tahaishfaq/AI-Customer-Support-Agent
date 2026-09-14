"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1];

const STEPS = [
  {
    index: "01",
    title: "Connect",
    body: "Add FAQs and documents so your agent answers from your knowledge — not invents policy.",
  },
  {
    index: "02",
    title: "Configure",
    body: "Set tone, tools, and handoff rules in the studio. Test as a visitor before you embed.",
  },
  {
    index: "03",
    title: "Go live",
    body: "Drop the widget on your site, watch conversations, and claim handoffs from the human desk.",
  },
];

const STAGGER_CLASS = ["lg:mt-0", "lg:mt-8", "lg:mt-16"];

function StepCard({ step, index, active }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.li
      className={cn("relative flex pl-12 lg:pl-0", STAGGER_CLASS[index])}
      initial={false}
      animate={
        active
          ? { opacity: 1, y: 0 }
          : { opacity: reduceMotion ? 1 : 0, y: reduceMotion ? 0 : 24 }
      }
      transition={{
        duration: 0.5,
        ease: EASE,
        delay: active ? 0.1 + index * 0.1 : 0,
      }}
    >
      <article className="landing-process-step flex h-full w-full flex-col py-1 lg:py-0">
        <span className="absolute left-0 top-0 z-10 flex size-8 items-center justify-center rounded-full border border-[var(--color-primary)] bg-[var(--landing-panel)] text-[11px] font-semibold text-[var(--color-primary)] lg:static lg:size-auto lg:w-fit lg:justify-start lg:rounded-full lg:border-0 lg:bg-[var(--landing-ink)] lg:px-3 lg:py-1 lg:text-white">
          <span className="hidden lg:inline">Step </span>
          {step.index}
        </span>

        <h3 className="landing-display mt-4 text-[1.35rem] text-[var(--landing-ink)] sm:text-[1.5rem] lg:mt-5">
          {step.title}
        </h3>

        <div className="landing-dot-b my-3 sm:my-4" aria-hidden />

        <p className="hidden text-[14px] leading-relaxed text-[var(--landing-muted)] sm:block sm:text-[15px]">
          {step.body}
        </p>
      </article>
    </motion.li>
  );
}

export function LandingHowItWorks() {
  const stepsRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const stepsInView = useInView(stepsRef, { amount: 0.25, once: true });
  const active = reduceMotion || stepsInView;

  return (
    <section
      id="how-it-works"
      className="landing-section landing-section-grid bg-[var(--landing-panel)]"
    >
      <div className="landing-dot-b grid gap-4 px-5 py-8 sm:px-6 sm:py-10 lg:grid-cols-[1fr_auto] lg:items-end lg:gap-10 lg:px-8">
        <div>
          <p className="text-[12px] font-semibold tracking-[0.14em] text-[var(--color-primary)] uppercase">
            Process
          </p>
          <h2 className="landing-display mt-3 max-w-xl text-3xl text-[var(--landing-ink)] sm:text-4xl md:text-[2.5rem] md:leading-[1.15]">
            Three steps to go live.
          </h2>
        </div>
      </div>

      <div
        ref={stepsRef}
        className="px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-12"
      >
        <ol className="relative grid gap-5 before:absolute before:bottom-5 before:left-4 before:top-5 before:border-l before:border-dotted before:border-[var(--landing-dot)] sm:gap-6 lg:grid-cols-3 lg:gap-6 lg:before:hidden">
          {STEPS.map((step, index) => (
            <StepCard
              key={step.index}
              step={step}
              index={index}
              active={active}
            />
          ))}
        </ol>
      </div>
    </section>
  );
}
