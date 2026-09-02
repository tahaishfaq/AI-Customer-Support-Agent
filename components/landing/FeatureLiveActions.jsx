"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Loader2, Sparkles } from "lucide-react";

const STEPS = [
  { id: "policy", label: "Retrieve refund policy" },
  { id: "status", label: "Call get_order_status" },
  { id: "confirm", label: "Confirm with visitor" },
  { id: "refund", label: "Run refund_order" },
];

const IDS = STEPS.map((s) => s.id);

function pendingMap() {
  return Object.fromEntries(IDS.map((id) => [id, "pending"]));
}

function StatusIcon({ status }) {
  if (status === "done") {
    return <Check className="size-4 shrink-0 text-[var(--color-primary)]" />;
  }
  if (status === "busy") {
    return (
      <Loader2 className="size-4 shrink-0 animate-spin text-[var(--landing-muted)]" />
    );
  }
  return <span className="size-4 shrink-0 rounded-full border border-black/10" />;
}

function orderedIds(status, mode, reverse) {
  const base = reverse ? [...IDS].reverse() : [...IDS];

  if (mode === "pipeline") return base;

  if (mode === "done-top") {
    return [...base].sort((a, b) => {
      const rank = { done: 0, busy: 1, pending: 2 };
      return rank[status[a]] - rank[status[b]];
    });
  }

  // active-top: busy first, then pending, then done (good for reverse feel)
  return [...base].sort((a, b) => {
    const rank = { busy: 0, pending: 1, done: 2 };
    return rank[status[a]] - rank[status[b]];
  });
}

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function FeatureLiveActions() {
  const reduceMotion = useReducedMotion();
  const [status, setStatus] = useState(pendingMap);
  const [mode, setMode] = useState("pipeline");
  const [reverse, setReverse] = useState(false);

  const order = useMemo(
    () => orderedIds(status, mode, reverse),
    [status, mode, reverse]
  );

  const labelById = useMemo(
    () => Object.fromEntries(STEPS.map((s) => [s.id, s.label])),
    []
  );

  useEffect(() => {
    if (reduceMotion) {
      setStatus({
        policy: "done",
        status: "done",
        confirm: "busy",
        refund: "pending",
      });
      setMode("pipeline");
      return undefined;
    }

    let cancelled = false;

    async function runPass(isReverse) {
      const sequence = isReverse ? [...IDS].reverse() : [...IDS];
      setReverse(isReverse);
      setMode("pipeline");
      setStatus(pendingMap());
      await wait(450);
      if (cancelled) return;

      for (let i = 0; i < sequence.length; i += 1) {
        const id = sequence[i];
        setMode(isReverse ? "active-top" : "pipeline");
        setStatus((prev) => ({ ...prev, [id]: "busy" }));
        await wait(1050);
        if (cancelled) return;

        setStatus((prev) => ({ ...prev, [id]: "done" }));
        setMode(isReverse ? "active-top" : "done-top");
        await wait(700);
        if (cancelled) return;
      }

      await wait(1400);
    }

    async function loop() {
      while (!cancelled) {
        await runPass(false);
        if (cancelled) return;
        await runPass(true);
      }
    }

    loop();

    return () => {
      cancelled = true;
    };
  }, [reduceMotion]);

  return (
    <div className="w-full max-w-[19.5rem] rounded-2xl border border-white/70 bg-white/95 p-3.5 shadow-[0_22px_50px_-18px_rgba(0,0,0,0.5)] backdrop-blur-md">
      <div className="mb-2.5 flex items-center justify-between px-0.5">
        <p className="text-[10px] font-semibold tracking-[0.12em] text-[var(--landing-muted)] uppercase">
          Actions
        </p>
        <p className="text-[10px] font-medium text-[var(--landing-muted)]">
          {reverse ? "Bottom → top" : "Top → bottom"}
        </p>
      </div>

      <ul className="relative flex flex-col gap-2">
        <AnimatePresence initial={false} mode="popLayout">
          {order.map((id) => (
            <motion.li
              key={id}
              layout={!reduceMotion}
              initial={reduceMotion ? false : { opacity: 0.55, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{
                layout: { type: "spring", stiffness: 420, damping: 34 },
                opacity: { duration: 0.2 },
                scale: { duration: 0.2 },
              }}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                status[id] === "busy"
                  ? "border-[var(--color-primary)]/30 bg-white shadow-sm"
                  : status[id] === "done"
                    ? "border-black/[0.04] bg-[#f7f5f2]"
                    : "border-black/[0.05] bg-[#faf9f7]"
              }`}
            >
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-lg shadow-sm transition-colors ${
                  status[id] === "done"
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-white text-[var(--color-primary)]"
                }`}
              >
                <Sparkles className="size-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-[var(--landing-ink)]">
                {labelById[id]}
              </span>
              <StatusIcon status={status[id]} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
