"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const SENTIMENT_BARS = [38, 52, 45, 61, 55, 68, 71];

const METRICS = [
  { label: "Resolved", value: 94, suffix: "%" },
  { label: "Avg reply", value: 2.3, suffix: "s", decimals: 1 },
  { label: "Handoffs", value: 12, suffix: "" },
];

const TOPICS = [
  { label: "Shipping", pct: 42 },
  { label: "Returns", pct: 28 },
  { label: "Billing", pct: 18 },
];

const RECENT = [
  { topic: "Shipping delay", status: "Resolved", time: "2m ago" },
  { topic: "Refund request", status: "Handed off", time: "8m ago" },
];

const EASE = [0.22, 1, 0.36, 1];

function DottedRule({ className }) {
  return (
    <div
      className={cn("border-b border-dotted border-white/15", className)}
      aria-hidden
    />
  );
}

function useCountUp(target, active, { duration = 700, decimals = 0 } = {}) {
  const [value, setValue] = useState(decimals > 0 ? 0 : 0);

  useEffect(() => {
    if (!active) {
      setValue(0);
      return undefined;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setValue(target);
      return undefined;
    }

    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      const next = target * eased;
      setValue(decimals > 0 ? Number(next.toFixed(decimals)) : Math.round(next));

      if (progress < 1) {
        window.requestAnimationFrame(tick);
      }
    };

    const id = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(id);
  }, [active, target, duration, decimals]);

  return value;
}

function MetricValue({ metric, active }) {
  const count = useCountUp(metric.value, active, {
    decimals: metric.decimals ?? 0,
  });

  return (
    <p className="mt-1.5 text-base font-semibold tabular-nums text-white sm:text-lg">
      {metric.decimals ? count.toFixed(metric.decimals) : count}
      {metric.suffix}
    </p>
  );
}

export function FeatureLiveInsights() {
  const rootRef = useRef(null);
  const reduceMotion = useReducedMotion();
  const inView = useInView(rootRef, { amount: 0.35, once: true });
  const active = reduceMotion || inView;

  const sentiment = useCountUp(71, active, { duration: 900 });

  return (
    <motion.div
      ref={rootRef}
      className="w-full max-w-[22rem] border border-dotted border-white/20 sm:max-w-none"
      initial={false}
      animate={
        active
          ? { opacity: 1, y: 0 }
          : { opacity: reduceMotion ? 1 : 0.35, y: reduceMotion ? 0 : 18 }
      }
      transition={{ duration: 0.55, ease: EASE }}
    >
      <motion.div
        className="flex items-center justify-between px-4 py-3 sm:px-5"
        initial={false}
        animate={active ? { opacity: 1, x: 0 } : { opacity: 0, x: -10 }}
        transition={{ duration: 0.45, ease: EASE, delay: active ? 0.05 : 0 }}
      >
        <div>
          <p className="text-[10px] font-semibold tracking-[0.14em] text-white/50 uppercase">
            Analytics
          </p>
          <p className="mt-0.5 text-sm font-medium text-white">Last 7 days</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-dotted border-white/20 px-2.5 py-1 text-[10px] font-medium text-white/70">
          <span className="relative flex size-1.5">
            {active ? (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400/70 opacity-60" />
            ) : null}
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
          </span>
          Live
        </span>
      </motion.div>

      <DottedRule />

      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-end justify-between gap-4">
          <motion.div
            className="min-w-0"
            initial={false}
            animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: 0.5, ease: EASE, delay: active ? 0.12 : 0 }}
          >
            <p className="text-[10px] font-semibold tracking-[0.14em] text-white/50 uppercase">
              Positive sentiment
            </p>
            <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-[1.75rem] font-semibold leading-none tracking-tight text-white">
                {sentiment}%
              </span>
              <motion.span
                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-emerald-400"
                initial={false}
                animate={
                  active
                    ? { opacity: 1, x: 0 }
                    : { opacity: 0, x: reduceMotion ? 0 : 6 }
                }
                transition={{ duration: 0.45, ease: EASE, delay: active ? 0.35 : 0 }}
              >
                <TrendingUp className="size-3" strokeWidth={2.25} />
                +4% vs last week
              </motion.span>
            </p>
          </motion.div>

          <div
            className="flex h-16 shrink-0 items-end gap-1 sm:h-[4.5rem] sm:gap-1.5"
            aria-hidden
          >
            {SENTIMENT_BARS.map((height, index) => (
              <motion.div
                key={`bar-${index}`}
                className="w-2 origin-bottom rounded-sm bg-[var(--color-primary)]/85 sm:w-2.5"
                initial={false}
                animate={{
                  scaleY: active ? height / 100 : 0.12,
                  opacity: active ? 1 : 0.35,
                }}
                transition={{
                  duration: 0.65,
                  ease: EASE,
                  delay: active ? 0.18 + index * 0.06 : 0,
                }}
                style={{ height: "100%" }}
              />
            ))}
          </div>
        </div>
      </div>

      <DottedRule />

      <div className="grid grid-cols-3">
        {METRICS.map((metric, index) => (
          <motion.div
            key={metric.label}
            className={cn(
              "px-3 py-3.5 sm:px-4 sm:py-4",
              index < METRICS.length - 1 &&
                "border-r border-dotted border-white/15"
            )}
            initial={false}
            animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{
              duration: 0.45,
              ease: EASE,
              delay: active ? 0.42 + index * 0.08 : 0,
            }}
          >
            <p className="text-[9px] font-semibold tracking-[0.14em] text-white/50 uppercase">
              {metric.label}
            </p>
            <MetricValue metric={metric} active={active} />
          </motion.div>
        ))}
      </div>

      <DottedRule />

      <div className="px-4 py-4 sm:px-5 sm:py-5">
        <motion.p
          className="text-[10px] font-semibold tracking-[0.14em] text-white/50 uppercase"
          initial={false}
          animate={active ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.4, delay: active ? 0.55 : 0 }}
        >
          Top topics
        </motion.p>
        <ul className="mt-3 space-y-3">
          {TOPICS.map((topic, index) => (
            <motion.li
              key={topic.label}
              initial={false}
              animate={active ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
              transition={{
                duration: 0.45,
                ease: EASE,
                delay: active ? 0.62 + index * 0.09 : 0,
              }}
            >
              <div className="flex items-center justify-between gap-3 text-[11px]">
                <span className="text-white/85">{topic.label}</span>
                <span className="shrink-0 tabular-nums text-white/45">
                  {topic.pct}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-[var(--color-primary)]"
                  initial={false}
                  animate={{ width: active ? `${topic.pct}%` : "0%" }}
                  transition={{
                    duration: 0.7,
                    ease: EASE,
                    delay: active ? 0.7 + index * 0.1 : 0,
                  }}
                />
              </div>
            </motion.li>
          ))}
        </ul>
      </div>

      <DottedRule />

      <ul>
        {RECENT.map((item, index) => (
          <motion.li
            key={item.topic}
            className={cn(
              "flex items-center justify-between gap-3 px-4 py-2.5 text-[11px] sm:px-5",
              index < RECENT.length - 1 &&
                "border-b border-dotted border-white/15"
            )}
            initial={false}
            animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            transition={{
              duration: 0.45,
              ease: EASE,
              delay: active ? 0.9 + index * 0.1 : 0,
            }}
          >
            <span className="truncate text-white/80">{item.topic}</span>
            <span className="flex shrink-0 items-center gap-2 text-white/45">
              <span
                className={cn(
                  "rounded-full border border-dotted px-2 py-0.5 text-[9px] font-medium tracking-wide uppercase",
                  item.status === "Resolved"
                    ? "border-emerald-400/35 text-emerald-300"
                    : "border-[var(--color-primary)]/35 text-[var(--color-primary)]"
                )}
              >
                {item.status}
              </span>
              {item.time}
            </span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}
