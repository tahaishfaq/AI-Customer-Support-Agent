"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Palette, Rocket, SlidersHorizontal, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { updateAgent } from "@/lib/api/agents";
import { resolveCustomization } from "@/lib/customization/defaults";
import { AppearanceForm } from "@/components/customization/AppearanceForm";
import { CustomizationPreview } from "@/components/customization/CustomizationPreview";
import { DeployForm } from "@/components/customization/DeployForm";
import { FeaturesForm } from "@/components/customization/FeaturesForm";
import { IdentityForm } from "@/components/customization/IdentityForm";

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
    description: "Embed code, launcher, and proactive message.",
    icon: Rocket,
  },
  {
    id: "features",
    label: "Features",
    title: "Agent Features",
    description: "Feedback, uploads, history, and sound.",
    icon: SlidersHorizontal,
  },
];

export function CustomizationStudio({ agent }) {
  const [sectionId, setSectionId] = useState("identity");
  const [draft, setDraft] = useState(() => resolveCustomization(agent));
  const [saved, setSaved] = useState(() =>
    JSON.stringify(resolveCustomization(agent))
  );
  const [saving, setSaving] = useState(false);
  const section = SECTIONS.find((s) => s.id === sectionId) || SECTIONS[0];
  const dirty = JSON.stringify(draft) !== saved;

  useEffect(() => {
    const next = resolveCustomization(agent);
    setDraft(next);
    setSaved(JSON.stringify(next));
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
    <div className="hapy-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-tight text-[var(--color-text)]">
            Customization
          </h2>
          <p className="mt-0.5 text-[13px] text-[var(--color-muted)]">
            Style the chat widget. Preview updates as you edit — save to keep it.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium",
              dirty
                ? "bg-[var(--color-warning)]/10 text-[var(--color-warning)]"
                : "bg-[var(--color-success)]/10 text-[var(--color-success)]"
            )}
          >
            {dirty ? "Unsaved changes" : "Saved"}
          </span>
          <Button type="button" size="sm" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Check className="size-3.5" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 lg:grid-cols-[200px_minmax(0,1fr)_minmax(280px,360px)]">
        <nav
          className="flex gap-1 overflow-x-auto border-b border-[var(--color-border)] bg-[var(--color-bg)]/50 p-2 lg:flex-col lg:overflow-visible lg:border-r lg:border-b-0"
          aria-label="Customization sections"
        >
          {SECTIONS.map((item) => {
            const active = item.id === sectionId;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSectionId(item.id)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors",
                  active
                    ? "bg-white text-[var(--color-primary)] shadow-sm ring-1 ring-[var(--color-border)]"
                    : "text-[var(--color-muted)] hover:bg-white/70 hover:text-[var(--color-text)]"
                )}
              >
                <Icon className="size-3.5 shrink-0" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <section className="min-w-0 border-b border-[var(--color-border)] lg:border-b-0 lg:border-r">
          <div className="border-b border-[var(--color-border)] px-5 py-3.5">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">
              {section.title}
            </h3>
            <p className="mt-0.5 text-[12px] text-[var(--color-muted)]">
              {section.description}
            </p>
          </div>
          <div className="max-h-[min(68dvh,740px)] overflow-y-auto px-5 py-5">
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
                onChange={(appearance) => patchSection("appearance", appearance)}
              />
            ) : null}
            {sectionId === "deploy" ? (
              <DeployForm
                agentId={agent.id}
                publicKey={agent.publicKey}
                deploy={draft.deploy}
                identity={draft.identity}
                onChange={(deploy) => patchSection("deploy", deploy)}
              />
            ) : null}
            {sectionId === "features" ? (
              <FeaturesForm
                features={draft.features}
                onChange={(features) => patchSection("features", features)}
              />
            ) : null}
          </div>
        </section>

        <aside className="self-start bg-[var(--color-bg)]/40 p-4">
          <p className="mb-2 text-[12px] font-medium text-[var(--color-muted)]">
            Live preview
          </p>
          <CustomizationPreview agent={agent} customization={draft} />
        </aside>
      </div>
    </div>
  );
}
