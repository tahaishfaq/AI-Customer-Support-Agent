/**
 * Vanilla JS scroll-reveal (same behavior as LandingReveal.jsx)
 *
 * HTML:
 *   <div class="landing-reveal" data-landing-reveal data-delay="60">...</div>
 *   <div class="landing-reveal-fade" data-landing-reveal data-fade-only>...</div>
 *
 * After DOM ready:
 *   import { initLandingReveals } from './landing-reveal.js';
 *   initLandingReveals();
 */
export function initLandingReveals(root = document) {
  const nodes = root.querySelectorAll("[data-landing-reveal]");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  nodes.forEach((el) => {
    const delay = Number(el.getAttribute("data-delay") || 0);
    if (delay) el.style.transitionDelay = `${delay}ms`;

    if (reduced) {
      el.classList.add("landing-reveal--visible");
      return;
    }

    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < vh * 0.92 && rect.bottom > vh * 0.08) {
      el.classList.add("landing-reveal--visible");
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("landing-reveal--visible");
          observer.disconnect();
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px 10% 0px" }
    );
    observer.observe(el);
  });
}
