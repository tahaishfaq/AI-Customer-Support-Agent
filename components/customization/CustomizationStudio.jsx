"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Cable,
  Check,
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

      <div className="grid min-h-0 lg:grid-cols-[200px_minmax(0,1fr)_minmax(280px,360px)]">
        <nav
          className="flex gap-1 overflow-x-auto border-b border-border bg-muted/30 p-2 lg:flex-col lg:overflow-visible lg:border-r lg:border-b-0"
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

        <section className="min-w-0 border-b border-border lg:border-r lg:border-b-0">
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
                  actionsEnabled={agent.actionsEnabled !== false}
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

        <aside className="self-start bg-muted/30 p-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Live preview
          </p>
          <CustomizationPreview agent={agent} customization={draft} />
        </aside>
      </div>
    </Card>
  );
}
