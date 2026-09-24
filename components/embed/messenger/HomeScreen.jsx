"use client";

import { ChevronRight, CircleAlert, CircleCheck, SendHorizontal, SquareArrowOutUpRight, Wrench } from "lucide-react";
import { formatRelative, monogram } from "@/components/conversations/format";
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

/** Latest conversation, newest first — only rendered when the visitor has history. */
function RecentMessageCard({ conversation, intro, onOpen, onSeeAll }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-3.5">
        <span className="text-[13px] font-semibold">Recent message</span>
        {onSeeAll ? (
          <button
            type="button"
            onClick={onSeeAll}
            className="text-[13px] font-medium hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ color: "var(--wc-primary)" }}
          >
            See all
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onOpen(conversation.id)}
        className="flex w-full items-center gap-3 px-5 pb-4 pt-2.5 text-left transition-colors hover:bg-black/[0.03] focus-visible:outline-2 focus-visible:-outline-offset-2"
        aria-label={`Open recent conversation: ${conversation.preview || "Conversation"}`}
      >
        {intro.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={intro.avatarUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" />
        ) : (
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold"
            style={{ backgroundColor: "var(--wc-primary)", color: "var(--wc-primary-fg)" }}
            aria-hidden
          >
            {monogram(intro.name)}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px]">{conversation.preview || "Conversation"}</span>
          <span className="block truncate text-[12px]" style={{ color: "var(--wc-muted)" }}>
            {intro.name} · {formatRelative(conversation.updatedAt)}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0" style={{ color: "var(--wc-muted)" }} aria-hidden />
      </button>
    </Card>
  );
}

export function HomeScreen({ customization, intro, onSendMessage, onClose, recentConversation = null, onOpenConversation, onSeeAll }) {
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
            showAideLogo={!customization?.branding?.hideAideBranding}
            logoVariant={customization?.appearance?.theme === "dark" ? "light" : "dark"}
            monogramFallback={false}
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

        {recentConversation && typeof onOpenConversation === "function" ? (
          <RecentMessageCard
            conversation={recentConversation}
            intro={intro}
            onOpen={onOpenConversation}
            onSeeAll={onSeeAll}
          />
        ) : null}

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
