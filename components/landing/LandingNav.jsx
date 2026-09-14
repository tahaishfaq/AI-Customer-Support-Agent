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
        <div className="landing-nav-bar grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 md:grid-cols-[1fr_auto_1fr] md:gap-4 md:px-6 lg:px-8">
          <AideLogo
            href="/"
            size="md"
            priority
            className="shrink-0 justify-self-start"
          />

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

          <div className="flex shrink-0 items-center justify-self-end gap-2 md:gap-3">
            <Link
              href="/login"
              className="hidden h-9 items-center px-2 text-[13px] font-medium text-[var(--landing-muted)] transition-colors hover:text-[var(--landing-ink)] sm:inline-flex"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="landing-nav-control landing-btn-ink inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-md px-3 text-[13px] font-medium leading-none transition-opacity hover:opacity-90 sm:px-4"
            >
              Get started
            </Link>
            <button
              type="button"
              className="landing-nav-control inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-black/10 text-[var(--landing-ink)] md:hidden"
              aria-expanded={open}
              aria-controls="landing-mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
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

      </div>

      <div className={cn("landing-mobile-menu md:hidden", open && "is-open")}>
          <button
            type="button"
            className="landing-mobile-menu-backdrop"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <aside
            id="landing-mobile-menu"
            className="landing-mobile-menu-panel"
            aria-label="Mobile navigation"
            aria-hidden={!open}
          >
            <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--landing-muted)]">
                Menu
              </span>
              <button
                type="button"
                className="inline-flex size-9 items-center justify-center rounded-md border border-black/10 text-[var(--landing-ink)]"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              >
                <span aria-hidden className="text-xl leading-none">
                  ×
                </span>
              </button>
            </div>
            <div className="flex flex-col gap-1 px-5 py-5">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-3 py-3 text-sm font-medium text-[var(--landing-ink)] transition-colors hover:bg-black/[0.04]"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <Link
                href="/login"
                className="rounded-md px-3 py-3 text-sm font-medium text-[var(--landing-ink)] transition-colors hover:bg-black/[0.04]"
                onClick={() => setOpen(false)}
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="landing-btn-ink mt-3 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium"
                onClick={() => setOpen(false)}
              >
                Get started
              </Link>
            </div>
          </aside>
      </div>
    </header>
  );
}
