"use client";

import { useLayoutEffect, useCallback, useRef, useState } from "react";
import { ArrowUp, Paperclip, Plus, Send, Smile, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CHAT_UPLOAD_MAX_BYTES,
  formatChatUploadLimit,
} from "@/lib/utils/chat-attachments";

export function ChatComposer({
  disabled,
  onSend,
  onValueChange,
  compact = false,
  placeholder = "Type a message…",
  footer,
  allowFileUpload = false,
  themed = false,
  uploadUrl,
  busyHint: _busyHint,
  /** While a reply streams: shows Stop in place of Send. */
  onStop,
  /** "messenger": one rounded box — text on top, attach/emoji row + round send (embed widget). */
  variant = "default",
}) {
  const messenger = variant === "messenger";
  const [value, setValue] = useState("");
  const [uploading, setUploading] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textareaRef = useRef(null);
  const fileRef = useRef(null);

  const minH = messenger ? 24 : themed ? 32 : 36;
  const maxH = messenger ? 120 : themed ? 64 : 72;
  const busy = disabled || uploading;
  // Typing feedback lives in the message list — keep a normal placeholder while busy.
  const activePlaceholder = placeholder;
  const emojis = [
    "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣",
    "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰",
    "😘", "😎", "🤩", "🤔", "🫡", "😐", "😑", "🙄",
    "😏", "😣", "😥", "😮", "🤐", "😯", "😴", "🤗",
    "🤭", "🤫", "😶", "😌", "😔", "😢", "😭", "😤",
    "😠", "😡", "🤬", "🤯", "😱", "😨", "😰", "😳",
    "🥳", "🤪", "😜", "😝", "🤓", "🧐", "😇", "🥲",
    "👍", "👎", "👏", "🙌", "👐", "🤝", "🙏", "💪",
    "👋", "✌️", "🤞", "👌", "🤌", "☝️", "👆", "👇",
    "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
    "💔", "💯", "🔥", "⭐", "✨", "🎉", "🎊", "✅",
    "❌", "⚠️", "💡", "🚀", "🎁", "🏆", "🌟", "💬",
  ];

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    // Collapse first so empty state does not inherit a tall browser default scrollHeight.
    el.style.height = "0px";
    const next = Math.min(Math.max(el.scrollHeight, minH), maxH);
    el.style.height = `${next}px`;
    el.style.overflowY = next >= maxH ? "auto" : "hidden";
  }, [maxH, minH, value]);

  const sendingRef = useRef(false);

  function submit() {
    const text = value.trim();
    if (!text || busy || sendingRef.current) return;
    sendingRef.current = true;
    onSend(text);
    setValue("");
    onValueChange?.("");
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      sendingRef.current = false;
    });
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function insertEmoji(emoji) {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${emoji}${value.slice(end)}`;
    setValue(next);
    onValueChange?.(next);
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      el?.focus();
      const cursor = start + emoji.length;
      el?.setSelectionRange(cursor, cursor);
    });
  }

  async function onFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !uploadUrl) return;
    if (file.size > CHAT_UPLOAD_MAX_BYTES) {
      toast.error(`File must be ${formatChatUploadLimit()} or smaller`);
      return;
    }
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
        throw new Error(
          data?.error?.details?.file ||
            data?.error?.message ||
            "Upload failed"
        );
      }
      if (data.message) await onSend(data.message);
    } catch (err) {
      toast.error(err.message || "Unable to upload file");
    } finally {
      setUploading(false);
    }
  }

  const emojiPicker = emojiOpen ? (
    <div
      className="absolute bottom-full right-3 z-50 mb-2 grid max-h-[min(280px,45svh)] w-[min(300px,calc(100vw-1rem))] grid-cols-8 gap-1 overflow-y-auto rounded-md border p-2 shadow-lg"
      style={{ backgroundColor: "var(--wc-shell)", borderColor: "var(--wc-border)" }}
      role="dialog"
      aria-label="Emoji picker"
    >
      {emojis.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => insertEmoji(emoji)}
          className="flex size-8 items-center justify-center rounded-md text-lg hover:bg-black/5"
          aria-label={`Insert ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  ) : null;

  if (messenger) {
    const canSend = !busy && Boolean(value.trim());
    return (
      <div className="relative shrink-0 px-4 pb-3 pt-2" style={{ backgroundColor: "var(--wc-chat-bg)" }}>
        <div
          className="rounded-[calc(var(--wc-radius)+2px)] border border-[var(--wc-border)] bg-[var(--wc-input-bg)] px-4 pb-2.5 pt-3 transition-colors focus-within:border-[var(--wc-shell-fg)]"
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              onValueChange?.(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder === "Type your message..." ? "Message…" : activePlaceholder}
            disabled={busy}
            aria-busy={busy}
            aria-label="Message"
            rows={1}
            className="block w-full resize-none border-0 bg-transparent text-[15px] leading-6 text-[var(--wc-shell-fg)] outline-none placeholder:text-[var(--wc-muted)] disabled:cursor-not-allowed disabled:opacity-50"
            style={{ minHeight: minH, maxHeight: maxH }}
          />
          <div className="mt-2 flex items-center gap-1">
            {allowFileUpload ? (
              <>
                <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf,.txt,.csv,.doc,.docx" onChange={onFileChange} />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex size-8 items-center justify-center rounded-full text-[var(--wc-muted)] hover:bg-black/5 hover:text-[var(--wc-shell-fg)] disabled:opacity-45"
                  aria-label="Attach file"
                  title={`Attach file (max ${formatChatUploadLimit()})`}
                >
                  <Paperclip className="size-[19px]" strokeWidth={1.8} />
                </button>
              </>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => setEmojiOpen((open) => !open)}
              className="inline-flex size-8 items-center justify-center rounded-full text-[var(--wc-muted)] hover:bg-black/5 hover:text-[var(--wc-shell-fg)] disabled:opacity-45"
              aria-label="Add emoji"
              aria-expanded={emojiOpen}
            >
              <Smile className="size-[20px]" strokeWidth={1.8} />
            </button>
            <span className="flex-1" />
            {onStop ? (
              <button
                type="button"
                onClick={onStop}
                aria-label="Stop response"
                className="inline-flex size-10 items-center justify-center rounded-full"
                style={{ backgroundColor: "var(--wc-primary)", color: "var(--wc-primary-fg)" }}
              >
                <Square className="size-3.5" fill="currentColor" />
              </button>
            ) : (
              <button
                type="button"
                disabled={!canSend}
                onClick={submit}
                aria-label="Send message"
                className="inline-flex size-10 items-center justify-center rounded-full transition-colors"
                style={
                  canSend
                    ? { backgroundColor: "var(--wc-primary)", color: "var(--wc-primary-fg)" }
                    : { backgroundColor: "color-mix(in srgb, var(--wc-shell-fg) 10%, transparent)", color: "var(--wc-muted)" }
                }
              >
                <ArrowUp className="size-5" strokeWidth={2.2} />
              </button>
            )}
          </div>
        </div>
        {emojiPicker}
        {footer ? (
          <p className="mt-1.5 text-center text-[10px] text-[var(--wc-muted)]">{footer}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative shrink-0 border-t",
        themed
          ? "border-[var(--wc-border)] bg-[var(--wc-shell)]"
          : "border-[var(--color-border)] bg-[var(--color-surface)]",
        compact || themed ? "px-3 py-1.5" : "px-4 py-3 sm:px-8"
      )}
    >
      <div className={cn("flex items-end gap-2", themed && "items-center")}>
        {themed && allowFileUpload ? (
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
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--wc-muted)] transition-colors hover:bg-black/5 hover:text-[var(--wc-shell-fg)] disabled:cursor-not-allowed disabled:opacity-45"
              aria-label="Attach file"
              title={`Attach file (max ${formatChatUploadLimit()})`}
            >
              <Plus className="size-[22px]" strokeWidth={1.8} />
            </button>
          </>
        ) : null}
        <div
          className={cn(
            // Fixed radius (not pill/9999) so multiline + scroll stay ChatGPT-like, not a capsule.
            "flex min-h-8 min-w-0 flex-1 items-end gap-0.5 rounded-md",
            themed
              ? "border bg-[var(--wc-input-bg)] pl-3 pr-1 focus-within:ring-2 focus-within:ring-[var(--wc-primary)]/25"
              : "border border-[var(--color-border)] bg-[var(--color-bg)] pl-3 pr-1 focus-within:border-[var(--color-primary)] focus-within:ring-2 focus-within:ring-[var(--color-primary)]/20"
          )}
          style={
            themed
              ? { borderColor: "var(--wc-input-border)" }
              : undefined
          }
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              onValueChange?.(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder={activePlaceholder}
            disabled={busy}
            aria-busy={busy}
            rows={1}
            className={cn(
              "h-8 min-w-0 flex-1 resize-none border-0 bg-transparent py-1.5 text-[13px] leading-5 outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50",
              themed
                ? "text-[var(--wc-shell-fg)] placeholder:text-[var(--wc-muted)]"
                : "text-[var(--color-text)] placeholder:text-[var(--color-muted)]"
            )}
            style={{ minHeight: minH, maxHeight: maxH }}
          />
          {allowFileUpload && !themed ? (
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
                  "mb-1 inline-flex size-7 shrink-0 items-center justify-center rounded-full",
                  themed
                    ? "text-[var(--wc-muted)] hover:bg-black/5 hover:text-[var(--wc-shell-fg)]"
                    : "text-[var(--color-muted)] hover:bg-[var(--color-bg)]"
                )}
                aria-label="Attach file"
                title={`Attach file (max ${formatChatUploadLimit()})`}
              >
                <Paperclip className="size-3.5" />
              </button>
            </>
          ) : null}
        </div>
        {themed ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setEmojiOpen((open) => !open)}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--wc-muted)] transition-colors hover:bg-black/5 hover:text-[var(--wc-shell-fg)] disabled:cursor-not-allowed disabled:opacity-45"
            aria-label="Add emoji"
            aria-expanded={emojiOpen}
            title="Add emoji"
          >
            <Smile className="size-[21px]" strokeWidth={1.8} />
          </button>
        ) : null}
        {onStop ? (
          <Button
            type="button"
            size="icon"
            onClick={onStop}
            aria-label="Stop response"
            className={cn(
              "size-9 shrink-0 rounded-full shadow-none",
              themed && "bg-[#171313] text-white hover:bg-[#171313]/90"
            )}
          >
            <Square className="size-3" fill="currentColor" />
          </Button>
        ) : (
        <Button
          type="button"
          size="icon"
          disabled={busy || !value.trim()}
          onClick={submit}
          aria-label="Send message"
          className={cn(
            "size-9 shrink-0 rounded-full shadow-none",
            themed &&
              "bg-[#171313] text-white hover:bg-[#171313]/90 disabled:bg-[#171313]/35 disabled:opacity-100"
          )}
        >
          <Send className="size-3.5" />
        </Button>
        )}
      </div>
      {themed && emojiOpen ? (
        <div
          className="absolute bottom-full right-3 z-50 mb-2 grid max-h-[min(280px,45svh)] w-[min(300px,calc(100vw-1rem))] grid-cols-8 gap-1 overflow-y-auto rounded-md border p-2 shadow-lg"
          style={{
            backgroundColor: "var(--wc-shell)",
            borderColor: "var(--wc-border)",
          }}
          role="dialog"
          aria-label="Emoji picker"
        >
          {emojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => insertEmoji(emoji)}
              className="flex size-8 items-center justify-center rounded-md text-lg hover:bg-black/5"
              aria-label={`Insert ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      ) : null}
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
