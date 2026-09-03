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
      className={cn("flex", STAGGER_CLASS[index])}
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
      <article className="landing-dot-frame flex h-full w-full flex-col bg-white p-5 sm:p-6">
        <span className="inline-flex w-fit rounded-full bg-[var(--landing-ink)] px-3 py-1 text-[11px] font-medium tracking-wide text-white">
          Step {step.index}
        </span>

        <h3 className="landing-display mt-5 text-[1.35rem] text-[var(--landing-ink)] sm:text-[1.5rem]">
          {step.title}
        </h3>

        <div className="landing-dot-b my-4" aria-hidden />

        <p className="text-[14px] leading-relaxed text-[var(--landing-muted)] sm:text-[15px]">
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
        className="px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12"
      >
        <ol className="grid gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
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
