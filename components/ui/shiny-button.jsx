"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.(REDUCED_MOTION_QUERY)?.matches ?? false;
}

function subscribeToReducedMotion(callback) {
  if (typeof window === "undefined") return () => {};
  const mediaQueryList = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQueryList.addEventListener("change", callback);
  return () => mediaQueryList.removeEventListener("change", callback);
}

function getServerReducedMotionSnapshot() {
  return false;
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    prefersReducedMotion,
    getServerReducedMotionSnapshot
  );
}

/**
 * White-label gleam-edge button / chat launcher.
 * Accent colors should come from agent appearance (primaryColor / --wc-primary).
 */
export function ShinyButton({
  label = "Get Started",
  onClick,
  className = "",
  fillColor = "var(--wc-shell, #ffffff)",
  labelColor = "var(--wc-shell-fg, #0f172a)",
  accentColor = "var(--wc-primary, #ea580c)",
  accentSoftColor,
  sweepDuration = 3,
  easeDuration = 0.8,
  arcWidth = 5,
  cornerRadius = 32,
  showSpeckle = true,
  showSheen = true,
  speckleOpacity = 0.4,
  variant = "button",
  children,
  "aria-label": ariaLabel,
  "aria-expanded": ariaExpanded,
  "aria-controls": ariaControls,
  tabIndex,
  buttonRef,
  style,
  type = "button",
  disabled = false,
  "data-open": dataOpen,
  /** Launcher geometry (px); defaults keep the original 68×40 rounded rectangle. */
  launcherWidth,
  launcherHeight,
  launcherRadius,
  /** Launcher ring: animated "gradient" (default), static "solid", or "none". */
  ring = "gradient",
}) {
  const reducedMotion = usePrefersReducedMotion();
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const scope = `gleam-edge-${instanceId}`;
  const isLauncher = variant === "launcher";
  const soft =
    accentSoftColor ||
    `color-mix(in srgb, ${accentColor} 55%, white)`;
  // Launcher: rounded rectangle (not a circle / not a squircle blob).
  const radius = isLauncher
    ? Number.isFinite(launcherRadius)
      ? launcherRadius
      : Math.min(16, Math.max(8, Number(cornerRadius) || 16))
    : cornerRadius;
  const ringMode = isLauncher ? ring : "gradient";
  const borderLayer =
    ringMode === "solid"
      ? "linear-gradient(var(--gleam-accent), var(--gleam-accent)) border-box"
      : ringMode === "none"
        ? "linear-gradient(transparent, transparent) border-box"
        : null;
  const accessibleLabel = ariaLabel || label;
  const launcherPad = 2.5;
  const [tabHidden, setTabHidden] = useState(false);

  useEffect(() => {
    if (!isLauncher || typeof document === "undefined") return undefined;
    function sync() {
      setTabHidden(Boolean(document.hidden));
    }
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [isLauncher]);

  const pauseGleam =
    isLauncher &&
    (ringMode !== "gradient" ||
      dataOpen === true ||
      dataOpen === "true" ||
      tabHidden ||
      reducedMotion);

  const css = `
    @property --gradient-angle-${instanceId} {
      syntax: "<angle>";
      initial-value: 0deg;
      inherits: false;
    }
    @property --gradient-angle-offset-${instanceId} {
      syntax: "<angle>";
      initial-value: 0deg;
      inherits: false;
    }
    @property --gradient-percent-${instanceId} {
      syntax: "<percentage>";
      initial-value: ${arcWidth}%;
      inherits: false;
    }
    @property --gradient-shine-${instanceId} {
      syntax: "<color>";
      initial-value: white;
      inherits: false;
    }

    .${scope} {
      --gleam-base: ${fillColor};
      --gleam-inset: color-mix(in srgb, ${fillColor} 88%, #1a1818);
      --gleam-label: ${labelColor};
      --gleam-accent: ${accentColor};
      --gleam-accent-soft: ${soft};
      --animation: gradient-angle-${instanceId} linear infinite;
      --duration: ${sweepDuration}s;
      --shadow-size: 2px;
      --transition: ${easeDuration}s cubic-bezier(0.25, 1, 0.5, 1);

      isolation: isolate;
      position: relative;
      overflow: ${isLauncher ? "visible" : "hidden"};
      cursor: pointer;
      outline-offset: 4px;
      padding: ${isLauncher ? `${launcherPad}px` : "1.25rem 2.5rem"};
      font-size: ${isLauncher ? "0" : "1.125rem"};
      line-height: ${isLauncher ? "0" : "1.2"};
      font-weight: 500;
      border: 1px solid transparent;
      border-radius: ${radius}px;
      color: var(--gleam-label);
      background:
        linear-gradient(var(--gleam-base), var(--gleam-base)) padding-box,
        conic-gradient(
          from calc(var(--gradient-angle-${instanceId}) - var(--gradient-angle-offset-${instanceId})),
          transparent 0%,
          transparent 55%,
          var(--gleam-accent) 72%,
          var(--gradient-shine-${instanceId}) 82%,
          var(--gleam-accent) 90%,
          transparent 100%
        ) border-box;
      box-shadow: ${isLauncher ? "none" : "inset 0 0 0 1px var(--gleam-inset)"};
      transition: var(--transition);
      transition-property:
        --gradient-angle-offset-${instanceId},
        --gradient-percent-${instanceId},
        --gradient-shine-${instanceId};
    }

    .${scope}.gleam-launcher {
      display: flex;
      align-items: center;
      justify-content: center;
      width: ${launcherWidth ? `${launcherWidth}px` : "4.25rem"};
      min-width: ${launcherWidth ? `${launcherWidth}px` : "4.25rem"};
      height: ${launcherHeight ? `${launcherHeight}px` : "2.5rem"};
      flex-shrink: 0;
      /* Ring stays on border-box only; face covers the interior */
      background-clip: padding-box, border-box;
    }

    .${scope}.gleam-launcher-sm {
      width: 3.75rem;
      height: 2.25rem;
    }

    .${scope}::before,
    .${scope}::after,
    .${scope} > .gleam-face::before {
      content: "";
      pointer-events: none;
      position: absolute;
      inset-inline-start: 50%;
      inset-block-start: 50%;
      translate: -50% -50%;
      z-index: -1;
    }

    .${scope}:active {
      translate: 0 1px;
    }

    .${scope}::before {
      --size: calc(100% - var(--shadow-size) * 3);
      --position: 2px;
      --space: calc(var(--position) * 2);
      width: var(--size);
      height: var(--size);
      background: radial-gradient(
        circle at var(--position) var(--position),
        white calc(var(--position) / 4),
        transparent 0
      ) padding-box;
      background-size: var(--space) var(--space);
      background-repeat: space;
      mask-image: conic-gradient(
        from calc(var(--gradient-angle-${instanceId}) + 45deg),
        black,
        transparent 10% 90%,
        black
      );
      border-radius: inherit;
      opacity: ${showSpeckle ? speckleOpacity : 0};
      z-index: -1;
    }

    .${scope}::after {
      --animation: shimmer-${instanceId} linear infinite;
      width: 100%;
      aspect-ratio: 1;
      background: linear-gradient(
        -50deg,
        transparent,
        var(--gleam-accent),
        transparent
      );
      mask-image: radial-gradient(circle at bottom, transparent 40%, black);
      opacity: ${showSheen ? 0.6 : 0};
    }

    /* Launcher: no face overlays — gradient lives only in the border ring */
    .${scope}.gleam-launcher::before,
    .${scope}.gleam-launcher::after {
      content: none !important;
      display: none !important;
      opacity: 0 !important;
      animation: none !important;
    }

    .${scope} > .gleam-face {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      overflow: hidden;
      border-radius: inherit;
      background: var(--gleam-base);
    }

    ${borderLayer ? `.${scope}.gleam-launcher {
      background: linear-gradient(var(--gleam-base), var(--gleam-base)) padding-box, ${borderLayer};
      ${ringMode === "none" ? "box-shadow: 0 4px 14px rgba(15,23,42,0.18);" : ""}
    }` : ""}

    .${scope}.gleam-launcher > .gleam-face {
      z-index: 2;
      border-radius: ${Math.max(4, radius - launcherPad)}px;
      background: var(--gleam-base);
      /* Fully opaque face so border gradient never bleeds onto logo */
      box-shadow: none;
    }

    .${scope}.gleam-launcher > .gleam-face::before {
      content: none !important;
      display: none !important;
    }

    .${scope} > .gleam-face::before {
      --size: calc(100% + 1rem);
      width: var(--size);
      height: var(--size);
      box-shadow: inset 0 -1ex 2rem 4px var(--gleam-accent);
      opacity: 0;
      transition: opacity var(--transition);
      animation: calc(var(--duration) * 1.5) breathe-${instanceId} linear infinite;
    }

    .${scope},
    .${scope}::before,
    .${scope}::after {
      animation:
        var(--animation) var(--duration),
        var(--animation) calc(var(--duration) / 0.4) reverse paused;
      animation-composition: add;
    }

    /* Launcher: border-ring sweep only (no overlay layers) */
    .${scope}.gleam-launcher {
      animation: gradient-angle-${instanceId} var(--duration) linear infinite;
      animation-play-state: running;
    }

    .${scope}.gleam-launcher[data-gleam-paused="true"] {
      animation-play-state: paused !important;
    }

    .${scope}.gleam-launcher::before,
    .${scope}.gleam-launcher::after {
      animation: none !important;
    }

    /* Pill CTA: amplify shine on hover */
    .${scope}:not(.gleam-launcher):is(:hover, :focus-visible) {
      --gradient-percent-${instanceId}: 20%;
      --gradient-angle-offset-${instanceId}: 95deg;
      --gradient-shine-${instanceId}: var(--gleam-accent-soft);
    }

    .${scope}:is(:hover, :focus-visible),
    .${scope}:is(:hover, :focus-visible)::before,
    .${scope}:is(:hover, :focus-visible)::after {
      animation-play-state: running;
    }

    /* Launcher: keep brand colors stable — only motion/sheen, no color shift */
    .${scope}.gleam-launcher:is(:hover, :focus-visible) {
      --gradient-percent-${instanceId}: ${arcWidth}%;
      --gradient-angle-offset-${instanceId}: 0deg;
      --gradient-shine-${instanceId}: white;
    }

    .${scope}:not(.gleam-launcher):is(:hover, :focus-visible) > .gleam-face::before {
      opacity: 1;
    }

    .${scope}.gleam-launcher:is(:hover, :focus-visible) > .gleam-face::before {
      opacity: 0;
    }

    @keyframes gradient-angle-${instanceId} {
      to {
        --gradient-angle-${instanceId}: 360deg;
      }
    }

    @keyframes shimmer-${instanceId} {
      to {
        rotate: 360deg;
      }
    }

    @keyframes breathe-${instanceId} {
      from,
      to {
        scale: 1;
      }
      50% {
        scale: 1.2;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .${scope},
      .${scope}::before,
      .${scope}::after,
      .${scope} > .gleam-face::before {
        animation: none !important;
      }

      .${scope}:is(:hover, :focus-visible),
      .${scope}:is(:hover, :focus-visible)::before,
      .${scope}:is(:hover, :focus-visible)::after {
        animation-play-state: paused !important;
      }

      .${scope}:is(:hover, :focus-visible) > .gleam-face::before {
        opacity: 0;
      }

      .${scope} {
        transition: none;
      }
    }
  `;

  return (
    <>
      <style>{css}</style>
      <button
        ref={buttonRef}
        type={type}
        disabled={disabled}
        className={cn(
          scope,
          isLauncher && "gleam-launcher",
          className
        )}
        style={style}
        onClick={onClick}
        aria-label={accessibleLabel}
        aria-expanded={ariaExpanded}
        aria-controls={ariaControls}
        tabIndex={tabIndex}
        data-open={
          dataOpen === true || dataOpen === "true"
            ? "true"
            : dataOpen === false || dataOpen === "false"
              ? "false"
              : undefined
        }
        data-gleam-paused={pauseGleam ? "true" : undefined}
        data-reduced-motion={reducedMotion ? "true" : undefined}
      >
        <span className="gleam-face">
          {isLauncher ? children : <span>{label}</span>}
        </span>
      </button>
    </>
  );
}

export default ShinyButton;
