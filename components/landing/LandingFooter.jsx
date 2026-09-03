import Link from "next/link";
import { AideLogo } from "@/components/brand/AideLogo";

const CONTACT = [
  { label: "hello@aide.app", href: "mailto:hello@aide.app" },
  { label: "Talk to sales", href: "#contact" },
  { label: "Reply within 24h", href: "#contact" },
];

const NAVIGATION = [
  { label: "Features", href: "#features" },
  { label: "Process", href: "#how-it-works" },
  { label: "Plans", href: "#plans" },
  { label: "FAQs", href: "#faq" },
];

const ACCOUNT = [
  { label: "Sign in", href: "/login" },
  { label: "Get started", href: "/register" },
  { label: "Contact", href: "#contact" },
];

function FooterTree({ title, items }) {
  return (
    <div className="landing-footer-tree">
      <p className="landing-footer-tree-label">{title}</p>
      <ul className="landing-footer-tree-list">
        {items.map((item) => (
          <li key={item.label}>
            {item.href.startsWith("/") ? (
              <Link href={item.href} className="landing-footer-tree-node">
                {item.label}
              </Link>
            ) : (
              <a href={item.href} className="landing-footer-tree-node">
                {item.label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="landing-footer landing-section relative overflow-hidden text-white">
      <div className="landing-footer-grid" aria-hidden />
      <div className="landing-footer-glow" aria-hidden />

      <div className="landing-footer-dot-b relative z-10 px-5 py-8 sm:px-6 sm:py-10 lg:flex lg:items-start lg:justify-between lg:gap-12 lg:px-8 lg:py-12">
        <AideLogo
          href="/"
          variant="light"
          size="lg"
          className="mb-10 shrink-0 lg:mb-0"
          markClassName="h-8 w-auto sm:h-9"
        />

        <div className="grid flex-1 gap-8 sm:grid-cols-3 sm:gap-6 lg:max-w-3xl lg:gap-8">
          <FooterTree title="Contact" items={CONTACT} />
          <FooterTree title="Navigation" items={NAVIGATION} />
          <FooterTree title="Account" items={ACCOUNT} />
        </div>
      </div>

      <div className="relative z-10 flex flex-col gap-3 px-5 py-5 text-[12px] text-white/40 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6 lg:px-8">
        <p>
          © {year} AIDE® <span className="text-white/25">|</span> All rights
          reserved
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <a href="#contact" className="transition-colors hover:text-white/70">
            Terms of Service
          </a>
          <a href="#contact" className="transition-colors hover:text-white/70">
            Privacy Policy
          </a>
        </div>
        <p className="text-white/35">AI Customer Support & Insights</p>
      </div>
    </footer>
  );
}
