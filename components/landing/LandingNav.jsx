"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AideLogo } from "@/components/brand/AideLogo";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "#features", label: "Features" },
  { href: "#plans", label: "Plans" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#faq", label: "FAQ" },
  { href: "#contact", label: "Contact" },
];

const SCROLL_THRESHOLD = 8;

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const scrolledRef = useRef(false);

  useEffect(() => {
    let ticking = false;

    function readScroll() {
      ticking = false;
      const next = window.scrollY > SCROLL_THRESHOLD;
      if (next === scrolledRef.current) return;
      scrolledRef.current = next;
      setScrolled(next);
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(readScroll);
    }

    readScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50">
      <div
        className={cn(
          "landing-nav-shell pointer-events-auto",
          scrolled && "landing-nav-shell--scrolled"
        )}
      >
        <div className="landing-nav-bar grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 sm:px-6 lg:px-8">
          <AideLogo href="/" size="md" priority />

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link, i) => (
              <span key={link.href} className="flex items-center">
                {i > 0 ? (
                  <span className="mx-2 size-0.5 rounded-full bg-[var(--landing-muted)]/50" />
                ) : null}
                <a
                  href={link.href}
                  className="px-1 text-[13px] font-medium text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-ink)]"
                >
                  {link.label}
                </a>
              </span>
            ))}
          </nav>

          <div className="flex items-center justify-end gap-2 sm:gap-3">
            <Link
              href="/login"
              className="hidden h-9 items-center px-2 text-[13px] font-medium text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-ink)] sm:inline-flex"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="landing-btn-ink inline-flex h-9 items-center rounded-md px-4 text-[13px] font-medium transition-opacity hover:opacity-90"
            >
              Get started
            </Link>
            <button
              type="button"
              className="inline-flex size-9 items-center justify-center rounded-md border border-black/10 text-[var(--landing-ink)] md:hidden"
              aria-expanded={open}
              aria-label="Open menu"
              onClick={() => setOpen((v) => !v)}
            >
              <span className="sr-only">Menu</span>
              <span className="flex flex-col gap-1">
                <span className="block h-px w-4 bg-current" />
                <span className="block h-px w-4 bg-current" />
              </span>
            </button>
          </div>
        </div>

        {open ? (
          <div className="landing-dot-t bg-white px-5 py-4 sm:px-6 md:hidden">
            <div className="flex flex-col gap-3">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-[var(--landing-ink)]"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <Link
                href="/login"
                className="text-sm font-medium text-[var(--landing-ink)]"
                onClick={() => setOpen(false)}
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="text-sm font-medium text-[var(--color-primary)]"
                onClick={() => setOpen(false)}
              >
                Get started
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
