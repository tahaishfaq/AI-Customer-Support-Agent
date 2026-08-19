"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, ImagePlus, Loader2, MessageCircle, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { uploadAgentAvatar, regenerateAgentEmbed } from "@/lib/api/agents";
import {
  ChoiceCard,
  FieldBlock,
  FormSection,
  areaClass,
} from "@/components/customization/CustomizationFields";
import { buildEmbedSnippet } from "@/lib/customization/embed";
import { cn } from "@/lib/utils";

export function DeployForm({
  agentId,
  publicKey,
  deploy,
  identity,
  onChange,
  onPublicKeyChange,
}) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [origin, setOrigin] = useState("https://your-app.com");
  const snippet = buildEmbedSnippet(publicKey, origin);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  function patch(partial) {
    onChange({ ...deploy, ...partial });
  }

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      toast.success("Embed code copied");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy");
    }
  }

  async function regenerateSnippet() {
    setRegenerating(true);
    try {
      const updated = await regenerateAgentEmbed(agentId);
      onPublicKeyChange?.(updated.publicKey);
      setConfirmOpen(false);
      toast.success(
        "New embed script ready. Old snippet is disabled. If website knowledge is empty, the next live visit can crawl once."
      );
    } catch (err) {
      toast.error(err.message || "Unable to regenerate embed");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleButtonImage(file) {
    if (!file) return;
    setUploading(true);
    try {
      const data = await uploadAgentAvatar(agentId, file);
      patch({ buttonImageUrl: data.avatarUrl, useBotAvatar: false });
      toast.success("Button image uploaded");
    } catch (err) {
      toast.error(err.message || "Unable to upload image");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const buttonPreviewSrc = deploy.useBotAvatar
    ? identity?.avatarUrl
    : deploy.buttonImageUrl;

  return (
    <div className="space-y-6">
      <FormSection title="Install">
        <FieldBlock
          label="Embed code"
          hint="Copy this onto your webpage. Regenerate if the old snippet leaked or you want to kill live widgets."
        >
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[#0f172a]">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <span className="text-[11px] text-slate-400">embed snippet</span>
              <div className="flex items-center gap-1">
                {origin && publicKey ? (
                  <a
                    href={`${origin}/w/${publicKey}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-white/10"
                  >
                    <ExternalLink className="size-3.5" />
                    Open widget
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  disabled={regenerating}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-white/10 disabled:opacity-50"
                >
                  <RefreshCw className="size-3.5" />
                  Regenerate
                </button>
                <button
                  type="button"
                  onClick={copySnippet}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-white/10"
                >
                  {copied ? (
                    <Check className="size-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            <pre className="overflow-x-auto p-3 text-[11px] leading-relaxed text-slate-200">
              <code>{snippet}</code>
            </pre>
          </div>
          <p className="mt-2 text-[12px] text-[var(--color-muted)]">
            Regenerating issues a new public key. Sites still using the old
            script stop loading the widget immediately.
          </p>
        </FieldBlock>
      </FormSection>

      <FormSection title="Launcher">
        <FieldBlock
          label="Chat interface"
          hint="Choose how you want to add chat to your website."
        >
          <div className="grid grid-cols-2 gap-3">
            <ChoiceCard
              title="Toggle"
              selected={deploy.chatInterface === "toggle"}
              onClick={() => patch({ chatInterface: "toggle" })}
            >
              <div className="relative h-16 w-full max-w-[120px] rounded-md border border-slate-200 bg-white">
                <div className="absolute right-1.5 bottom-1.5 size-5 rounded-full bg-[var(--color-primary)]" />
              </div>
            </ChoiceCard>
            <ChoiceCard
              title="Embedded"
              selected={deploy.chatInterface === "embedded"}
              onClick={() => patch({ chatInterface: "embedded" })}
            >
              <div className="flex h-16 w-full max-w-[120px] items-center justify-center rounded-md border border-slate-200 bg-slate-100 p-1.5">
                <div className="h-full w-10 rounded border border-slate-300 bg-white shadow-sm" />
              </div>
            </ChoiceCard>
          </div>
        </FieldBlock>

        {deploy.chatInterface === "toggle" ? (
          <FieldBlock
            label="Chat launcher"
            hint="How should visitors open chat?"
          >
            <div className="grid grid-cols-2 gap-3">
              <ChoiceCard
                title="Chat bubble"
                selected={deploy.chatLauncher === "bubble"}
                onClick={() => patch({ chatLauncher: "bubble" })}
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-[var(--color-primary)] text-white">
                  <MessageCircle className="size-4" />
                </span>
              </ChoiceCard>
              <ChoiceCard
                title="Custom element"
                selected={deploy.chatLauncher === "custom"}
                onClick={() => patch({ chatLauncher: "custom" })}
              >
                <span className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600">
                  Element
                </span>
              </ChoiceCard>
            </div>
          </FieldBlock>
        ) : null}

        {deploy.chatInterface === "toggle" && deploy.chatLauncher === "bubble" ? (
          <FieldBlock
            label="Button image"
            hint="Upload an image for the launcher button."
          >
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]"
              >
                {buttonPreviewSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={buttonPreviewSrc}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <ImagePlus className="size-4 text-[var(--color-muted)]" />
                )}
                {uploading ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-white/70">
                    <Loader2 className="size-4 animate-spin text-[var(--color-primary)]" />
                  </span>
                ) : null}
              </button>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    patch({
                      useBotAvatar: true,
                      buttonImageUrl: null,
                    })
                  }
                  className={cn(
                    "text-left text-[13px] font-medium",
                    deploy.useBotAvatar
                      ? "text-[var(--color-primary)]"
                      : "text-[var(--color-muted)] hover:text-[var(--color-primary)]"
                  )}
                >
                  Use bot avatar
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="text-[13px] text-[var(--color-muted)] hover:text-[var(--color-text)]"
                  >
                    Upload image
                  </button>
                  {deploy.buttonImageUrl && !deploy.useBotAvatar ? (
                    <button
                      type="button"
                      onClick={() =>
                        patch({ buttonImageUrl: null, useBotAvatar: true })
                      }
                      className="inline-flex items-center gap-1 text-[13px] text-[var(--color-muted)] hover:text-[var(--color-danger)]"
                    >
                      <X className="size-3" />
                      Clear
                    </button>
                  ) : null}
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => handleButtonImage(e.target.files?.[0])}
              />
            </div>
          </FieldBlock>
        ) : null}

        {deploy.chatInterface === "toggle" && deploy.chatLauncher === "custom" ? (
          <p className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)]/60 px-3 py-3 text-[13px] text-[var(--color-muted)]">
            Custom element targeting (CSS selector) will ship with the public
            embed. Preview shows a sample trigger pill.
          </p>
        ) : null}
      </FormSection>

      <FormSection title="Engagement">
        <FieldBlock
          label="Proactive message"
          hint="A short message that appears above the chat bubble."
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-[13px] text-[var(--color-text)]">
              Show a greeting before the visitor opens chat.
            </p>
            <button
              type="button"
              role="switch"
              aria-checked={deploy.proactiveEnabled}
              onClick={() => patch({ proactiveEnabled: !deploy.proactiveEnabled })}
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                deploy.proactiveEnabled
                  ? "bg-[var(--color-primary)]"
                  : "bg-[var(--color-border)]"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform",
                  deploy.proactiveEnabled && "translate-x-5"
                )}
              />
            </button>
          </div>

          {deploy.proactiveEnabled ? (
            <div className="mt-3 space-y-3">
              <Textarea
                value={deploy.proactiveMessage}
                onChange={(e) => patch({ proactiveMessage: e.target.value })}
                rows={2}
                placeholder="Hi! Need help?"
                className={areaClass}
              />
              <div className="rounded-lg border border-[var(--color-border)] bg-white p-3">
                <div className="flex max-w-xs items-start gap-2">
                  {identity?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={identity.avatarUrl}
                      alt=""
                      className="size-7 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex size-7 items-center justify-center rounded-full bg-[var(--color-primary)] text-[10px] font-semibold text-white">
                      AI
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-[13px] text-[var(--color-text)]">
                      {deploy.proactiveMessage || "Hi! Need help?"}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">
                      a few moments ago
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </FieldBlock>
      </FormSection>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (regenerating) return;
          setConfirmOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Regenerate embed script?</DialogTitle>
            <DialogDescription>
              A new public key will replace the current one. Sites still using
              the old snippet will stop loading this widget until you paste the
              new code. If this agent has no website knowledge, the next live
              visit can crawl the host page once.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={regenerating}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={regenerating}
              onClick={regenerateSnippet}
            >
              {regenerating ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Regenerating…
                </>
              ) : (
                "Regenerate"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
