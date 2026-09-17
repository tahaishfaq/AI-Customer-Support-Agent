"use client";

import { ArrowRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { monogram } from "@/components/conversations/format";

export function EmbedWelcomeScreen({
  name,
  description,
  avatarUrl,
  onStart,
}) {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-5 sm:px-5"
      style={{
        backgroundColor: "var(--wc-chat-bg)",
        color: "var(--wc-shell-fg)",
      }}
    >
      <div className="flex flex-1 flex-col justify-between gap-6">
        <div className="pt-2">
          <div
            className="flex size-12 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: "var(--wc-primary)" }}
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="size-full object-cover" />
            ) : (
              monogram(name)
            )}
          </div>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight">
            Need help? <span aria-hidden>👋</span>
          </h2>
          <p className="mt-2 max-w-[30rem] text-sm leading-relaxed text-[var(--wc-muted)]">
            {description || `We are here to help. Ask ${name} a question or start a conversation.`}
          </p>
        </div>

        <div
          className="rounded-2xl border p-4"
          style={{
            borderColor: "var(--wc-border)",
            backgroundColor: "var(--wc-shell)",
          }}
        >
          <p className="text-sm font-semibold">Start a conversation</p>
          <p className="mt-1 text-xs text-[var(--wc-muted)]">
            Ask a question and the assistant will help you find an answer.
          </p>
          <Button
            type="button"
            variant="ghost"
            className="mt-4 h-auto w-full justify-between px-0 text-left text-sm font-semibold hover:bg-transparent"
            style={{ color: "var(--wc-shell-fg)" }}
            onClick={onStart}
          >
            <span className="inline-flex items-center gap-2">
              <MessageCircle className="size-4" aria-hidden />
              Start conversation
            </span>
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
