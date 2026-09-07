"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Cable,
  Check,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Palette,
  Rocket,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { updateAgent } from "@/lib/api/agents";
import { resolveCustomization } from "@/lib/customization/defaults";
import { useUrlTab } from "@/hooks/use-url-tab";
import { ActionsForm } from "@/components/customization/ActionsForm";
import { AppearanceForm } from "@/components/customization/AppearanceForm";
import { CustomizationPreview } from "@/components/customization/CustomizationPreview";
import { DeployForm } from "@/components/customization/DeployForm";
import { FeaturesForm } from "@/components/customization/FeaturesForm";
import { IdentityForm } from "@/components/customization/IdentityForm";
import { UniversalBusinessWizard } from "@/components/customization/UniversalBusinessWizard";

const SECTIONS = [
  {
    id: "identity",
    label: "Identity",
    title: "Bot Identity",
    description: "Name, avatar, footer, and contact details.",
    icon: UserRound,
  },
  {
    id: "appearance",
    label: "Appearance",
    title: "Agent Appearance",
    description: "Colors, theme, fonts, and message styling.",
    icon: Palette,
  },
  {
    id: "deploy",
    label: "Deploy",
    title: "Deploy Settings",
    description: "Embed code, launcher, crawl schedule, and proactive message.",
    icon: Rocket,
  },
  {
    id: "features",
    label: "Features",
    title: "Agent Features",
    description: "Feedback, uploads, history, and sound.",
    icon: SlidersHorizontal,
  },
  {
    id: "packs",
    label: "Packs",
    title: "Business packs",
    description:
      "Start from a vertical template — install guest + account starter tools.",
    icon: Building2,
  },
  {
    id: "actions",
    label: "Tools",
    title: "",
    description: "",
    icon: Cable,
  },
];

const SECTION_IDS = SECTIONS.map((s) => s.id);

export function CustomizationStudio({ agent, onAgentChange }) {
  const [sectionId, setSectionId] = useUrlTab("tab", SECTION_IDS, "identity");
  const [draft, setDraft] = useState(() => resolveCustomization(agent));
  const [saved, setSaved] = useState(() =>
    JSON.stringify(resolveCustomization(agent))
  );
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [publicKey, setPublicKey] = useState(agent.publicKey);
  const [pendingToolForm, setPendingToolForm] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const section = SECTIONS.find((s) => s.id === sectionId) || SECTIONS[0];
  const dirty = JSON.stringify(draft) !== saved;

  useEffect(() => {
    const next = resolveCustomization(agent);
    setDraft(next);
    setSaved(JSON.stringify(next));
    setPublicKey(agent.publicKey);
  }, [agent]);

  function patchSection(key, value) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await updateAgent(agent.id, { customization: draft });
      const next = resolveCustomization(updated);
      setDraft(next);
      setSaved(JSON.stringify(next));
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 900);
      toast.success("Customization saved");
    } catch (err) {
      const detail = Object.values(err.details || {}).find(Boolean);
      toast.error(
        detail && detail !== err.message
          ? `${err.message}: ${detail}`
          : err.message || "Unable to save customization"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="overflow-hidden shadow-none">
      <CardHeader className="border-b">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex flex-col gap-1">
            <CardTitle className="font-heading text-lg">Customization</CardTitle>
            <CardDescription>
              Style the chat widget. Preview updates as you edit — save to keep
              it.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={dirty ? "secondary" : "outline"}
              className={cn(
                "rounded-full transition-colors",
                justSaved && "animate-save-flash border-primary/40 text-primary"
              )}
            >
              {dirty ? "Unsaved changes" : "Saved"}
            </Badge>
            <Button
              type="button"
              size="sm"
              className={cn(
                "rounded-full transition-transform",
                justSaved && "animate-save-flash"
              )}
              onClick={handleSave}
              disabled={saving || !dirty}
            >
              {saving ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Saving…
                </>
              ) : (
                <>
                  <Check data-icon="inline-start" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <div className="flex min-h-0 flex-col lg:flex-row">
        <nav
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-muted/30 p-2 lg:w-[200px] lg:flex-col lg:overflow-visible lg:border-r lg:border-b-0"
          aria-label="Customization sections"
        >
          {SECTIONS.map((item) => {
            const active = item.id === sectionId;
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                type="button"
                variant={active ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setSectionId(item.id)}
                className={cn(
                  "justify-start",
                  active && "bg-card shadow-sm ring-1 ring-border"
                )}
              >
                <Icon data-icon="inline-start" />
                {item.label}
              </Button>
            );
          })}
        </nav>

        <section className="min-w-0 flex-1 border-b border-border transition-[flex-basis,width] duration-300 ease-[var(--ease-ui)] lg:border-b-0">
          {section.title || section.description ? (
            <div className="flex flex-col gap-0.5 border-b border-border px-5 py-3.5">
              {section.title ? (
                <h3 className="text-sm font-semibold">{section.title}</h3>
              ) : null}
              {section.description ? (
                <p className="text-xs text-muted-foreground">
                  {section.description}
                </p>
              ) : null}
            </div>
          ) : null}
          <ScrollArea className="h-[min(68dvh,740px)]">
            <div key={sectionId} className="animate-page-in px-5 py-5">
              {sectionId === "identity" ? (
                <IdentityForm
                  agentId={agent.id}
                  identity={draft.identity}
                  onChange={(identity) => patchSection("identity", identity)}
                />
              ) : null}
              {sectionId === "appearance" ? (
                <AppearanceForm
                  appearance={draft.appearance}
                  deploy={draft.deploy}
                  onChange={(appearance) =>
                    patchSection("appearance", appearance)
                  }
                  onDeployChange={(deploy) => patchSection("deploy", deploy)}
                />
              ) : null}
              {sectionId === "deploy" ? (
                <DeployForm
                  agentId={agent.id}
                  publicKey={publicKey}
                  deploy={draft.deploy}
                  identity={draft.identity}
                  crawlRecrawlHours={agent.crawlRecrawlHours ?? 0}
                  siteCrawledAt={agent.siteCrawledAt}
                  siteKnowledgeOrigin={agent.siteKnowledgeOrigin}
                  hasWebKnowledge={Boolean(agent.siteKnowledgeOrigin)}
                  onCrawlScheduleChange={(hours) => {
                    onAgentChange?.({ ...agent, crawlRecrawlHours: hours });
                  }}
                  onChange={(deploy) => patchSection("deploy", deploy)}
                  onPublicKeyChange={(nextKey) => {
                    setPublicKey(nextKey);
                    onAgentChange?.({ ...agent, publicKey: nextKey });
                  }}
                />
              ) : null}
              {sectionId === "features" ? (
                <FeaturesForm
                  features={draft.features}
                  onChange={(features) => patchSection("features", features)}
                />
              ) : null}
              {sectionId === "packs" ? (
                <UniversalBusinessWizard
                  agentId={agent.id}
                  onInstalled={() => setSectionId("actions")}
                  onOpenSlot={(form) => {
                    setPendingToolForm(form);
                    setSectionId("actions");
                  }}
                />
              ) : null}
              {sectionId === "actions" ? (
                <ActionsForm
                  agentId={agent.id}
                  agentName={agent.name}
                  siteKnowledgeOrigin={agent.siteKnowledgeOrigin}
                  actionsEnabled={Boolean(agent.actionsEnabled)}
                  pendingCreateForm={pendingToolForm}
                  onPendingCreateConsumed={() => setPendingToolForm(null)}
                  onActionsEnabledChange={(actionsEnabled) => {
                    onAgentChange?.({ ...agent, actionsEnabled });
                  }}
                />
              ) : null}
            </div>
          </ScrollArea>
        </section>

        {/* Mobile: compact toggle under forms */}
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2 lg:hidden">
          <span className="text-xs font-medium text-muted-foreground">
            Live preview
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-full"
            onClick={() => setPreviewOpen((v) => !v)}
            aria-expanded={previewOpen}
          >
            <MessageCircle data-icon="inline-start" />
            {previewOpen ? "Hide" : "Show"}
          </Button>
        </div>
        <div
          className={cn(
            "overflow-hidden bg-muted/30 transition-[max-height,opacity,padding] duration-300 ease-[var(--ease-ui)] lg:hidden",
            previewOpen
              ? "max-h-[720px] opacity-100 p-4"
              : "max-h-0 opacity-0 p-0"
          )}
        >
          <CustomizationPreview agent={agent} customization={draft} />
        </div>

        {/* Desktop: right rail — vertical tab + sliding panel */}
        <div className="relative hidden shrink-0 lg:flex">
          <button
            type="button"
            onClick={() => setPreviewOpen((v) => !v)}
            aria-expanded={previewOpen}
            aria-controls="customization-live-preview"
            title={previewOpen ? "Close live preview" : "Open live preview"}
            className={cn(
              "group z-10 flex w-9 shrink-0 flex-col items-center justify-center gap-2 border-l border-border bg-muted/40 py-6 text-muted-foreground outline-none transition-colors duration-300 ease-[var(--ease-ui)] hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40",
              previewOpen && "bg-muted text-foreground"
            )}
          >
            {previewOpen ? (
              <ChevronRight className="size-3.5 shrink-0 opacity-70" />
            ) : (
              <ChevronLeft className="size-3.5 shrink-0 opacity-70" />
            )}
            <MessageCircle className="size-3.5 shrink-0" />
            <span
              className="select-none text-[10px] font-semibold tracking-[0.14em] uppercase"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              Live preview
            </span>
          </button>

          <aside
            id="customization-live-preview"
            className={cn(
              "overflow-hidden border-l border-border bg-muted/30 transition-[width,opacity] duration-300 ease-[var(--ease-ui)] motion-reduce:transition-none",
              previewOpen
                ? "w-[min(320px,30vw)] opacity-100"
                : "w-0 border-l-0 opacity-0"
            )}
          >
            <div
              className={cn(
                "h-full w-[min(320px,30vw)] p-4 transition-transform duration-300 ease-[var(--ease-ui)] motion-reduce:transition-none",
                previewOpen ? "translate-x-0" : "translate-x-4"
              )}
            >
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Live preview
              </p>
              <CustomizationPreview agent={agent} customization={draft} />
            </div>
          </aside>
        </div>
      </div>
    </Card>
  );
}
