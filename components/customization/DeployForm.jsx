"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Code2,
  Copy,
  ExternalLink,
  FileCode2,
  Globe,
  ImagePlus,
  LayoutTemplate,
  Link2,
  MessageCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { uploadAgentAvatar, regenerateAgentEmbed } from "@/lib/api/agents";
import { installActionPack } from "@/lib/api/credentials";
import {
  SITE_DEMO_PACK_ID,
  siteDemoInstallCopy,
} from "@/lib/integrations/site-demo-pack";
import {
  ChoiceCard,
  FieldBlock,
  FormSection,
  areaClass,
} from "@/components/customization/CustomizationFields";
import { buildEmbedSnippet } from "@/lib/customization/embed";
import { CrawlSchedulePanel } from "@/components/knowledge/CrawlSchedulePanel";
import { cn } from "@/lib/utils";

const PLATFORMS = [
  {
    id: "html",
    label: "HTML",
    description: "Any website",
    icon: FileCode2,
  },
  {
    id: "react",
    label: "React",
    description: "SPA / Vite",
    icon: Code2,
  },
  {
    id: "next",
    label: "Next.js",
    description: "App Router",
    icon: LayoutTemplate,
  },
  {
    id: "wordpress",
    label: "WordPress",
    description: "Theme / plugin",
    icon: Globe,
  },
  {
    id: "share",
    label: "Shareable link",
    description: "Open in browser",
    icon: Link2,
  },
];

function platformSnippet(platformId, publicKey, origin) {
  const snippet = buildEmbedSnippet(publicKey, origin);
  if (platformId === "share") {
    return `${origin}/w/${publicKey || "YOUR_PUBLIC_KEY"}`;
  }
  if (platformId === "react" || platformId === "next") {
    return `// Add once in your root layout / _document
${snippet}`;
  }
  if (platformId === "wordpress") {
    return `<!-- Paste in footer.php or a Custom HTML block -->
${snippet}`;
  }
  return snippet;
}

function EmbedInstallDialog({
  open,
  onOpenChange,
  publicKey,
  origin,
  onRegenerate,
  regenerating,
}) {
  const [platformId, setPlatformId] = useState("html");
  const [copied, setCopied] = useState(false);
  const platform = PLATFORMS.find((p) => p.id === platformId) || PLATFORMS[0];
  const content = platformSnippet(platformId, publicKey, origin);
  const shareUrl = `${origin}/w/${publicKey}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success(
        platformId === "share" ? "Shareable link copied" : "Embed code copied"
      );
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>Install webchat</DialogTitle>
          <DialogDescription>
            Pick a platform, copy the snippet, and paste it on your site.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-[320px] sm:grid-cols-[200px_minmax(0,1fr)]">
          <nav className="flex gap-1 overflow-x-auto border-b border-border bg-muted/30 p-2 sm:flex-col sm:overflow-visible sm:border-r sm:border-b-0">
            {PLATFORMS.map((item) => {
              const Icon = item.icon;
              const active = item.id === platformId;
              return (
                <Button
                  key={item.id}
                  type="button"
                  variant={active ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setPlatformId(item.id)}
                  className={cn(
                    "h-auto justify-start gap-2 px-2.5 py-2",
                    active && "bg-card shadow-sm ring-1 ring-border"
                  )}
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 text-left">
                    <span className="block text-sm font-medium">
                      {item.label}
                    </span>
                    <span className="block text-[11px] font-normal text-muted-foreground">
                      {item.description}
                    </span>
                  </span>
                </Button>
              );
            })}
          </nav>

          <div className="flex min-w-0 flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{platform.label}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {publicKey ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    nativeButton={false}
                    render={
                      <a href={shareUrl} target="_blank" rel="noreferrer" />
                    }
                  >
                    <ExternalLink data-icon="inline-start" />
                    Open widget
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRegenerate}
                  disabled={regenerating}
                >
                  {regenerating ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <RefreshCw data-icon="inline-start" />
                  )}
                  Regenerate
                </Button>
                <Button type="button" size="sm" onClick={copy}>
                  {copied ? (
                    <Check data-icon="inline-start" />
                  ) : (
                    <Copy data-icon="inline-start" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>

            <pre className="max-h-[240px] flex-1 overflow-auto rounded-xl border border-border bg-zinc-950 p-4 text-[11px] leading-relaxed text-zinc-100">
              <code>{content}</code>
            </pre>

            <p className="text-xs text-muted-foreground">
              Regenerating issues a new public key. Sites still using the old
              script stop loading the widget immediately.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DeployForm({
  agentId,
  publicKey,
  deploy,
  identity,
  onChange,
  onPublicKeyChange,
  crawlRecrawlHours = 0,
  siteCrawledAt = null,
  siteKnowledgeOrigin = null,
  hasWebKnowledge = false,
  onCrawlScheduleChange,
}) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [installOpen, setInstallOpen] = useState(false);
  const [origin, setOrigin] = useState("https://your-app.com");
  const [sitePackBusy, setSitePackBusy] = useState(false);
  const [sitePackDone, setSitePackDone] = useState(false);
  const snippet = buildEmbedSnippet(publicKey, origin);

  const lockedHost = useMemo(() => {
    if (!siteKnowledgeOrigin) return null;
    try {
      return new URL(siteKnowledgeOrigin).host;
    } catch {
      return String(siteKnowledgeOrigin).replace(/^https?:\/\//, "");
    }
  }, [siteKnowledgeOrigin]);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function handleInstallSiteDemoPack() {
    if (!agentId) return;
    setSitePackBusy(true);
    try {
      const result = await installActionPack(agentId, SITE_DEMO_PACK_ID, {});
      const n = result.created?.length || 0;
      toast.success(
        n
          ? `Installed ${n} starter tools for ${lockedHost || "your site"}`
          : "Site demo tools already installed"
      );
      setSitePackDone(true);
    } catch (err) {
      toast.error(err.message || "Unable to install site demo pack");
    } finally {
      setSitePackBusy(false);
    }
  }

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
      {siteKnowledgeOrigin && !sitePackDone ? (
        <Alert>
          <Globe />
          <AlertTitle>Starter tools for {lockedHost || "your site"}</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{siteDemoInstallCopy(lockedHost)}</span>
            <Button
              type="button"
              size="sm"
              className="w-fit"
              disabled={sitePackBusy}
              onClick={handleInstallSiteDemoPack}
            >
              {sitePackBusy ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Plus data-icon="inline-start" />
              )}
              Install 6 starter tools
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <FormSection title="Install">
        <Alert className="mb-4">
          <ShieldCheck />
          <AlertTitle>Universal embed checklist</AlertTitle>
          <AlertDescription className="space-y-2 text-xs leading-relaxed">
            <p>
              1. Paste the snippet on every page where chat should appear.
            </p>
            <p>
              2. When the visitor is signed in, call{" "}
              <code className="rounded bg-muted px-1">aideChat.setUser</code>{" "}
              on <strong>every page load</strong> (not only after the login
              click).
            </p>
            <p>
              3. Live tools always show <strong>Confirm</strong> in the widget
              before calling your API. Guest lookups must return redacted data —
              never another customer&apos;s private fields.
            </p>
            <p>
              4. Use <strong>Packs</strong> for business templates, then point
              tool URLs at your APIs; enforce{" "}
              <code className="rounded bg-muted px-1">resource.owner == JWT.sub</code>{" "}
              on account endpoints.
            </p>
          </AlertDescription>
        </Alert>
        <FieldBlock
          label="Embed code"
          hint="Copy this onto your webpage. Regenerate if the old snippet leaked or you want to kill live widgets."
        >
          <div className="mb-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="rounded-full"
              onClick={() => setInstallOpen(true)}
            >
              <Code2 data-icon="inline-start" />
              Install webchat
            </Button>
            {origin && publicKey ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                nativeButton={false}
                render={
                  <a
                    href={`${origin}/w/${publicKey}`}
                    target="_blank"
                    rel="noreferrer"
                  />
                }
              >
                <ExternalLink data-icon="inline-start" />
                Open widget
              </Button>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-zinc-950">
            <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
              <span className="text-[11px] text-zinc-400">embed snippet</span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-zinc-200 hover:bg-white/10 hover:text-white"
                  onClick={() => setConfirmOpen(true)}
                  disabled={regenerating}
                >
                  <RefreshCw data-icon="inline-start" />
                  Regenerate
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-zinc-200 hover:bg-white/10 hover:text-white"
                  onClick={copySnippet}
                >
                  {copied ? (
                    <Check data-icon="inline-start" className="text-emerald-400" />
                  ) : (
                    <Copy data-icon="inline-start" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </div>
            <pre className="overflow-x-auto p-3 text-[11px] leading-relaxed text-zinc-200">
              <code>{snippet}</code>
            </pre>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
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
              <div className="relative h-16 w-full max-w-[120px] rounded-md border border-slate-300 bg-white shadow-sm">
                <div className="absolute right-1.5 bottom-1.5 size-5 rounded-full bg-primary" />
              </div>
            </ChoiceCard>
            <ChoiceCard
              title="Embedded"
              selected={deploy.chatInterface === "embedded"}
              onClick={() => patch({ chatInterface: "embedded" })}
            >
              <div className="flex h-16 w-full max-w-[120px] items-center justify-center rounded-md border border-slate-300 bg-slate-100 p-1.5 shadow-sm">
                <div className="h-full w-10 rounded border border-slate-200 bg-white shadow-sm" />
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
                <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <MessageCircle className="size-4" />
                </span>
              </ChoiceCard>
              <ChoiceCard
                title="Custom element"
                selected={deploy.chatLauncher === "custom"}
                onClick={() => patch({ chatLauncher: "custom" })}
              >
                <span className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm">
                  Element
                </span>
              </ChoiceCard>
            </div>
          </FieldBlock>
        ) : null}

        {deploy.chatInterface === "toggle" &&
        deploy.chatLauncher === "bubble" ? (
          <FieldBlock
            label="Button image"
            hint="Upload an image for the launcher button."
          >
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted"
              >
                {buttonPreviewSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={buttonPreviewSrc}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <ImagePlus className="size-4 text-muted-foreground" />
                )}
                {uploading ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-card/80">
                    <Spinner />
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
                    "text-left text-sm font-medium",
                    deploy.useBotAvatar
                      ? "text-primary"
                      : "text-muted-foreground hover:text-primary"
                  )}
                >
                  Use bot avatar
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Upload image
                  </button>
                  {deploy.buttonImageUrl && !deploy.useBotAvatar ? (
                    <button
                      type="button"
                      onClick={() =>
                        patch({ buttonImageUrl: null, useBotAvatar: true })
                      }
                      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive"
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

        {deploy.chatInterface === "toggle" &&
        deploy.chatLauncher === "custom" ? (
          <p className="rounded-xl border border-dashed border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
            Custom element targeting (CSS selector) will ship with the public
            embed. Preview shows a sample trigger pill.
          </p>
        ) : null}
      </FormSection>

      <CrawlSchedulePanel
        agentId={agentId}
        crawlRecrawlHours={crawlRecrawlHours}
        siteCrawledAt={siteCrawledAt}
        siteKnowledgeOrigin={siteKnowledgeOrigin}
        hasWeb={hasWebKnowledge}
        onSaved={onCrawlScheduleChange}
        variant="deploy"
      />

      <FormSection title="Engagement">
        <FieldBlock
          label="Proactive message"
          hint="A short message that appears above the chat bubble."
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-foreground">
              Show a greeting before the visitor opens chat.
            </p>
            <Switch
              checked={deploy.proactiveEnabled}
              onCheckedChange={(proactiveEnabled) =>
                patch({ proactiveEnabled })
              }
            />
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
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="flex max-w-xs items-start gap-2">
                  {identity?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={identity.avatarUrl}
                      alt=""
                      className="size-7 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex size-7 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                      AI
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">
                      {deploy.proactiveMessage || "Hi! Need help?"}
                    </p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      a few moments ago
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </FieldBlock>
      </FormSection>

      <EmbedInstallDialog
        open={installOpen}
        onOpenChange={setInstallOpen}
        publicKey={publicKey}
        origin={origin}
        regenerating={regenerating}
        onRegenerate={() => {
          setInstallOpen(false);
          setConfirmOpen(true);
        }}
      />

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
                  <Spinner data-icon="inline-start" />
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
