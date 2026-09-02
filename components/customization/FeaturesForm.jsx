"use client";

import { History, Paperclip, ThumbsUp, Volume2 } from "lucide-react";
import {
  FieldBlock,
  FormSection,
  fieldClass,
} from "@/components/customization/CustomizationFields";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function FeatureToggle({ label, description, checked, onChange, preview }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {description}
          </p>
        </div>
        <Switch checked={checked} onCheckedChange={onChange} />
      </div>
      {preview ? <div className="mt-3">{preview}</div> : null}
    </div>
  );
}

function MiniBox({ children }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">{children}</div>
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
          description="Thumbs up/down on bot replies. A downvote can include a short reason you review on the agent page."
          checked={features.messageFeedback}
          onChange={(messageFeedback) => patch({ messageFeedback })}
          preview={
            <MiniBox>
              <div className="flex items-start gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                  AI
                </span>
                <div className="min-w-0 flex-1">
                  <div className="rounded-2xl bg-muted px-3 py-2 text-sm text-foreground">
                    This is a message
                  </div>
                  {features.messageFeedback ? (
                    <div className="mt-1.5 flex gap-1 text-muted-foreground">
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
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted px-3 py-2.5 text-sm text-muted-foreground">
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
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Volume2 className="size-4 text-primary" />
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
                <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <History className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Past chats
                  </p>
                  <p className="text-xs text-muted-foreground">
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
          hint="Refresh keeps the current chat. After 1 day the widget starts a new chat (older threads stay in history until this reset)."
        >
          <Select
            value={features.historyReset}
            onValueChange={(historyReset) => {
              if (historyReset != null) patch({ historyReset });
            }}
          >
            <SelectTrigger className={fieldClass}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="never">Never</SelectItem>
                <SelectItem value="session">End of session</SelectItem>
                <SelectItem value="1d">After 1 day</SelectItem>
                <SelectItem value="7d">After 7 days</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </FieldBlock>
      </FormSection>
    </div>
  );
}
