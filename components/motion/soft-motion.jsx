"use client";

/**
 * Soft motion system (UI polish Phase 6).
 * Fade-up + stagger for KPI grids, desk lists, and chart cards only.
 * Always respects prefers-reduced-motion.
 */

import { motion, useReducedMotion } from "motion/react";

/** Shared ease — same curve as ChartCard / page-in feel. */
export const softEase = [0.22, 1, 0.36, 1];

export const softFadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: softEase },
};

const staggerParentVariants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.05, delayChildren: 0.04 },
  },
};

const staggerChildVariants = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: softEase },
  },
};

const MOTION_TAGS = {
  div: motion.div,
  section: motion.section,
  ul: motion.ul,
  li: motion.li,
  article: motion.article,
};

function resolveMotion(as) {
  if (typeof as === "string") return MOTION_TAGS[as] || motion.div;
  return as || motion.div;
}

/** Hook for composing motion props without wrapping extra DOM. */
export function useSoftMotion() {
  const reduce = useReducedMotion();

  return {
    reduce: Boolean(reduce),
    fadeUpProps: reduce
      ? { initial: false, animate: { opacity: 1, y: 0 } }
      : {
          initial: softFadeUp.initial,
          animate: softFadeUp.animate,
          transition: softFadeUp.transition,
        },
    staggerParentProps: reduce
      ? {}
      : {
          initial: "hidden",
          animate: "show",
          variants: staggerParentVariants,
        },
    staggerChildProps: reduce
      ? {}
      : {
          variants: staggerChildVariants,
        },
  };
}

/**
 * Single fade-up enter. Use for chart cards and one-off panels.
 * @param {"div"|"section"|"ul"|"li"|"article"|React.ElementType} [as]
 * @param {number} [delay]
 */
export function SoftFade({
  as = "div",
  children,
  className,
  delay = 0,
  ...props
}) {
  const reduce = useReducedMotion();
  const Comp = resolveMotion(as);

  return (
    <Comp
      className={className}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: reduce ? 0 : 0.35,
        ease: softEase,
        delay: reduce ? 0 : delay,
      }}
      {...props}
    >
      {children}
    </Comp>
  );
}

/** Parent for staggered children (KPI grid, inbox list). */
export function SoftStagger({ as = "div", children, className, ...props }) {
  const { staggerParentProps } = useSoftMotion();
  const Comp = resolveMotion(as);

  return (
    <Comp className={className} {...staggerParentProps} {...props}>
      {children}
    </Comp>
  );
}

/** Child of SoftStagger — one KPI or list row. */
export function SoftStaggerItem({ as = "div", children, className, ...props }) {
  const { staggerChildProps } = useSoftMotion();
  const Comp = resolveMotion(as);

  return (
    <Comp className={className} {...staggerChildProps} {...props}>
      {children}
    </Comp>
  );
}
