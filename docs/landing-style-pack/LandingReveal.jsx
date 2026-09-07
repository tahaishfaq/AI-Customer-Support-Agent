"use client";

/**
 * Portable copy of components/landing/LandingReveal.jsx
 * Drop into any React app. Classes come from landing-style.css
 */
import { useEffect, useRef, useState } from "react";

function cn(...parts) {
  return parts.filter(Boolean).join(" ");
}

function isInView(el) {
  const rect = el.getBoundingClientRect();
  const vh = window.innerHeight || document.documentElement.clientHeight;
  return rect.top < vh * 0.92 && rect.bottom > vh * 0.08;
}

export function LandingReveal({
  children,
  className,
  delay = 0,
  fadeOnly = false,
  style,
  as: Tag = "div",
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setVisible(true);
      return undefined;
    }

    if (isInView(el)) {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px 10% 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={cn(
        fadeOnly ? "landing-reveal-fade" : "landing-reveal",
        visible && "landing-reveal--visible",
        className
      )}
      style={{ transitionDelay: `${delay}ms`, ...style }}
    >
      {children}
    </Tag>
  );
}
