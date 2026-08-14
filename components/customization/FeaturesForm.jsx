"use client";

import { History, Paperclip, ThumbsUp, Volume2 } from "lucide-react";
import {
  FieldBlock,
  FormSection,
  fieldClass,
} from "@/components/customization/CustomizationFields";
import { cn } from "@/lib/utils";

function FeatureToggle({
  label,
  description,
  checked,
  onChange,
  preview,
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--color-text)]">
            {label}
          </p>
          <p className="mt-0.5 text-[12px] leading-snug text-[var(--color-muted)]">
            {description}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors",
            checked ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform",
              checked && "translate-x-5"
            )}
          />
        </button>
      </div>
      {preview ? <div className="mt-3">{preview}</div> : null}
    </div>
  );
}

function MiniBox({ children }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-white p-3">
      {children}
    </div>
  );
}

export function FeaturesForm({ features, onChange }) {
  function patch(partial) {
    onChange({ ...features, ...partial });
  }

  return (
    <div className="space-y-6">
      <FormSection title="Visitor tools">
        <FeatureToggle
          label="Message feedback"
          description="Thumbs up/down on bot replies so visitors can rate answers."
          checked={features.messageFeedback}
          onChange={(messageFeedback) => patch({ messageFeedback })}
          preview={
            <MiniBox>
              <div className="flex items-start gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-[var(--color-primary)] text-[10px] font-semibold text-white">
                  AI
                </span>
                <div className="min-w-0 flex-1">
                  <div className="rounded-2xl bg-[var(--color-bg)] px-3 py-2 text-[13px] text-[var(--color-text)]">
                    This is a message
                  </div>
                  {features.messageFeedback ? (
                    <div className="mt-1.5 flex gap-1 text-[var(--color-muted)]">
                      <ThumbsUp className="size-3.5" />
                      <ThumbsUp className="size-3.5 rotate-180" />
                    </div>
                  ) : null}
                </div>
              </div>
            </MiniBox>
          }
        />

        <FeatureToggle
          label="Allow file upload"
          description="Let visitors attach files in the composer."
          checked={features.fileUpload}
          onChange={(fileUpload) => patch({ fileUpload })}
          preview={
            <MiniBox>
              <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5 text-[13px] text-[var(--color-muted)]">
                <span className="flex-1">Type your message...</span>
                {features.fileUpload ? (
                  <Paperclip className="size-4 shrink-0" />
                ) : null}
              </div>
            </MiniBox>
          }
        />

        <FeatureToggle
          label="Message notification sound"
          description="Play a short alert when a new reply arrives."
          checked={features.notificationSound}
          onChange={(notificationSound) => patch({ notificationSound })}
          preview={
            features.notificationSound ? (
              <MiniBox>
                <div className="flex items-center gap-2 text-[13px] text-[var(--color-muted)]">
                  <Volume2 className="size-4 text-[var(--color-primary)]" />
                  Sound on for new replies
                </div>
              </MiniBox>
            ) : null
          }
        />
      </FormSection>

      <FormSection title="History">
        <FeatureToggle
          label="Conversation history"
          description="Show past chats so visitors can continue earlier threads."
          checked={features.conversationHistory}
          onChange={(conversationHistory) => patch({ conversationHistory })}
          preview={
            <MiniBox>
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
                  <History className="size-4" />
                </span>
                <div>
                  <p className="text-[13px] font-medium text-[var(--color-text)]">
                    Past chats
                  </p>
                  <p className="text-[11px] text-[var(--color-muted)]">
                    {features.conversationHistory
                      ? "History button visible in chat"
                      : "History hidden from visitors"}
                  </p>
                </div>
              </div>
            </MiniBox>
          }
        />

        <FieldBlock
          label="Chat history reset"
          hint="When to clear chat history stored in the browser."
        >
          <select
            value={features.historyReset}
            onChange={(e) => patch({ historyReset: e.target.value })}
            className={cn(
              fieldClass,
              "w-full border border-[var(--color-border)] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20"
            )}
          >
            <option value="never">Never</option>
            <option value="session">End of session</option>
            <option value="1d">After 1 day</option>
            <option value="7d">After 7 days</option>
          </select>
        </FieldBlock>
      </FormSection>
    </div>
  );
}
