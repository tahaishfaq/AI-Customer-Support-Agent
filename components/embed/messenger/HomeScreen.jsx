"use client";

import { CircleAlert, CircleCheck, SendHorizontal, SquareArrowOutUpRight, Wrench } from "lucide-react";
import { CloseButton, MessengerBrand } from "@/components/embed/messenger/MessengerParts";

const STATUS = {
  operational: { Icon: CircleCheck, tone: "#16a34a", fallback: "We're fully operational." },
  degraded: { Icon: CircleAlert, tone: "#d97706", fallback: "Some services are running slower than usual." },
  maintenance: { Icon: Wrench, tone: "#2563eb", fallback: "Scheduled maintenance is in progress." },
};

function Card({ as: Tag = "div", className = "", children, ...props }) {
  return (
    <Tag
      className={`block w-full rounded-[var(--wc-radius)] border text-left shadow-[0_1px_3px_rgba(15,23,42,0.06)] ${className}`}
      style={{ backgroundColor: "var(--wc-shell)", borderColor: "var(--wc-border)", color: "var(--wc-shell-fg)" }}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function HomeScreen({ customization, intro, onSendMessage, onClose }) {
  const identity = customization?.identity || {};
  const home = customization?.home || {};
  const status = home.status || {};
  const statusMeta = STATUS[status.level] || STATUS.operational;
  const links = Array.isArray(home.links) ? home.links : [];

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto" style={{ backgroundColor: "var(--wc-chat-bg)" }}>
      {/* Brand header that fades into the body, as in the reference. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[340px]"
        style={{
          background:
            "linear-gradient(180deg, var(--wc-primary) 0%, var(--wc-primary) 52%, color-mix(in srgb, var(--wc-primary) 35%, var(--wc-chat-bg)) 78%, var(--wc-chat-bg) 100%)",
        }}
      />
      <div className="relative flex flex-col gap-3 px-5 pb-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <MessengerBrand
            logoUrl={identity.logoUrl}
            avatarUrl={intro.avatarUrl}
            teamAvatars={identity.teamAvatars}
            name={intro.name}
            size="lg"
            onDark
          />
          <CloseButton onClose={onClose} onDark />
        </div>

        <h2
          className="mt-10 mb-4 text-[28px] font-semibold leading-[1.18] tracking-tight"
          style={{ color: "var(--wc-primary-fg)" }}
        >
          <span className="block">{identity.greetingTitle || "Hi there 👋"}</span>
          <span className="block">{identity.greetingSubtitle || "How can we help?"}</span>
        </h2>

        <Card as="button" type="button" onClick={onSendMessage} className="flex items-center justify-between gap-3 px-5 py-4 transition-transform hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2">
          <span className="text-[15px] font-semibold">Send us a message</span>
          <SendHorizontal className="size-5 shrink-0" style={{ color: "var(--wc-primary)" }} fill="currentColor" aria-hidden />
        </Card>

        {links.map((link) => (
          <Card
            key={`${link.label}-${link.url}`}
            as="a"
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 px-5 py-4 transition-transform hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span className="min-w-0 truncate text-[15px]">{link.label}</span>
            <SquareArrowOutUpRight className="size-[18px] shrink-0" aria-hidden />
          </Card>
        ))}

        {status.enabled ? (
          <Card className="overflow-hidden">
            <div className="flex items-center gap-4 px-5 py-4">
              <span
                className="flex size-14 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: `color-mix(in srgb, ${statusMeta.tone} 16%, transparent)` }}
              >
                <statusMeta.Icon className="size-6" style={{ color: statusMeta.tone }} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold">{intro.name}</span>
                <span className="block text-[14px]" style={{ color: "var(--wc-muted)" }}>
                  {status.message || statusMeta.fallback}
                </span>
              </span>
            </div>
            {status.url ? (
              <div className="border-t px-5 py-4" style={{ borderColor: "var(--wc-border)" }}>
                <a
                  href={status.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-[calc(var(--wc-radius)-4px)] px-4 py-3 text-center text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={{ backgroundColor: "var(--wc-primary)", color: "var(--wc-primary-fg)" }}
                >
                  Subscribe to updates
                </a>
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
