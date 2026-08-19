"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Paperclip, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ChatComposer({
  disabled,
  onSend,
  compact = false,
  placeholder = "Type a message…",
  footer,
  allowFileUpload = false,
  themed = false,
  uploadUrl,
}) {
  const [value, setValue] = useState("");
  const [uploading, setUploading] = useState(false);
  const textareaRef = useRef(null);
  const fileRef = useRef(null);

  const minH = 36;
  const maxH = 72;
  const busy = disabled || uploading;

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = `${minH}px`;
    const next = Math.min(Math.max(el.scrollHeight, minH), maxH);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxH ? "auto" : "hidden";
  }, [value]);

  function submit() {
    const text = value.trim();
    if (!text || busy) return;
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

  async function onFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !uploadUrl) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(uploadUrl, {
        method: "POST",
        body: form,
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error?.message || "Upload failed");
      }
      if (data.message) await onSend(data.message);
    } catch (err) {
      toast.error(err.message || "Unable to upload file");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      className={cn(
        "shrink-0 border-t",
        themed
          ? "border-[var(--wc-border)] bg-[var(--wc-shell)]"
          : "border-[var(--color-border)] bg-white",
        compact || themed ? "px-3 py-2" : "px-4 py-3 sm:px-8"
      )}
    >
      <div className="flex items-end gap-2">
        <div
          className={cn(
            "flex min-h-9 min-w-0 flex-1 items-end gap-0.5 py-0.5",
            themed
              ? "border bg-[var(--wc-input-bg)] pl-3 pr-1 focus-within:ring-2 focus-within:ring-[var(--wc-primary)]/25"
              : "border border-[var(--color-border)] bg-white pl-3 pr-1 focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-primary)]/20"
          )}
          style={
            themed
              ? {
                  borderRadius: 20,
                  borderColor: "var(--wc-input-border)",
                }
              : { borderRadius: 20 }
          }
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={busy}
            rows={1}
            className={cn(
              "min-w-0 flex-1 resize-none border-0 bg-transparent py-[7px] text-[13px] leading-[20px] outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50",
              themed
                ? "text-[var(--wc-shell-fg)] placeholder:text-[var(--wc-muted)]"
                : "placeholder:text-[var(--color-muted)]"
            )}
            style={{ minHeight: minH, maxHeight: maxH }}
          />
          {allowFileUpload ? (
            <>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf,.txt,.csv,.doc,.docx"
                onChange={onFileChange}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  "mb-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full",
                  themed
                    ? "text-[var(--wc-muted)] hover:bg-black/5 hover:text-[var(--wc-shell-fg)]"
                    : "text-[var(--color-muted)] hover:bg-[var(--color-bg)]"
                )}
                aria-label="Attach file"
                title="Attach file"
              >
                <Paperclip className="size-3.5" />
              </button>
            </>
          ) : null}
        </div>
        <Button
          type="button"
          size="icon"
          disabled={busy || !value.trim()}
          onClick={submit}
          aria-label="Send message"
          className={cn(
            "mb-0.5 size-9 shrink-0 rounded-full shadow-none",
            themed &&
              "bg-[var(--wc-primary)] text-white hover:opacity-90 disabled:bg-[var(--wc-primary)]/35 disabled:opacity-100"
          )}
        >
          <Send className="size-3.5" />
        </Button>
      </div>
      {footer ? (
        <p
          className={cn(
            "mt-1.5 text-center text-[10px]",
            themed ? "text-[var(--wc-muted)]" : "text-[var(--color-muted)]"
          )}
        >
          {footer}
        </p>
      ) : null}
    </div>
  );
}
