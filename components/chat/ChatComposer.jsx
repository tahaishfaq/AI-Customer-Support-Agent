"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Paperclip, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MIN_H = 40;
const MAX_H = 120;

export function ChatComposer({
  disabled,
  onSend,
  compact = false,
  placeholder = "Type a message…",
  footer,
  allowFileUpload = false,
  themed = false,
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef(null);

  const minH = compact ? 36 : MIN_H;
  const maxH = compact ? 96 : MAX_H;

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(Math.max(el.scrollHeight, minH), maxH);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxH ? "auto" : "hidden";
  }, [value, minH, maxH]);

  function submit() {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue("");
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div
      className={cn(
        "shrink-0 border-t",
        themed
          ? "border-[var(--wc-border)] bg-[var(--wc-shell)]"
          : "border-[var(--color-border)] bg-white",
        compact ? "px-3 py-2.5" : "px-4 py-3 sm:px-8"
      )}
    >
      <div className="flex items-end gap-2">
        {allowFileUpload ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              toast.message("File upload coming soon", {
                description: "Enabled in Customization — storage ships later.",
              })
            }
            className={cn(
              "mb-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full border",
              themed
                ? "border-[var(--wc-border)] text-[var(--wc-muted)] hover:bg-[var(--wc-chat-bg)]"
                : "border-[var(--color-border)] text-[var(--color-muted)] hover:bg-[var(--color-bg)]"
            )}
            aria-label="Attach file"
            title="Attach file"
          >
            <Paperclip className="size-4" />
          </button>
        ) : null}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={cn(
            "field-sizing-fixed flex-1 resize-none px-3 py-2 text-sm leading-5 outline-none transition-colors",
            "disabled:cursor-not-allowed disabled:opacity-50",
            compact ? "text-[13px]" : "text-sm",
            themed
              ? "border border-[var(--wc-border)] bg-[var(--wc-input-bg)] text-[var(--wc-shell-fg)] placeholder:text-[var(--wc-muted)] focus-visible:border-[var(--wc-primary)] focus-visible:ring-2 focus-visible:ring-[var(--wc-primary)]/20"
              : "border border-[var(--color-border)] bg-white placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/20"
          )}
          style={{
            minHeight: minH,
            maxHeight: maxH,
            borderRadius: themed ? "var(--wc-radius)" : undefined,
          }}
        />
        <Button
          type="button"
          size="icon"
          disabled={disabled || !value.trim()}
          onClick={submit}
          aria-label="Send message"
          className={cn(
            "shrink-0 rounded-full",
            compact ? "size-9" : "size-10",
            themed && "bg-[var(--wc-primary)] hover:opacity-90"
          )}
        >
          <Send className="size-4" />
        </Button>
      </div>
      {footer ? (
        <p
          className={cn(
            "mt-2 text-center text-[10px]",
            themed ? "text-[var(--wc-muted)]" : "text-[var(--color-muted)]"
          )}
        >
          {footer}
        </p>
      ) : null}
    </div>
  );
}
