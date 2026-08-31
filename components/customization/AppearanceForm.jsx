"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChoiceCard,
  FieldBlock,
  FormSection,
  MiniLabel,
  fieldClass,
} from "@/components/customization/CustomizationFields";
import { DEFAULT_CUSTOMIZATION } from "@/lib/customization/defaults";
import { WidgetLayoutPicker } from "@/components/customization/WidgetPositionPicker";
import { applyWidgetLayout } from "@/lib/customization/position";

const FONTS = [
  { id: "instrument-sans", label: "Instrument Sans" },
  { id: "dm-sans", label: "DM Sans" },
  { id: "system", label: "System" },
];

export function AppearanceForm({ appearance, deploy, onChange, onDeployChange }) {
  function patch(partial) {
    onChange({ ...appearance, ...partial });
  }

  function patchLayout(layoutId) {
    onDeployChange?.(applyWidgetLayout(deploy || {}, layoutId));
  }

  const primary = appearance.primaryColor || "#0b5f58";

  return (
    <div className="space-y-6">
      <FormSection title="Brand">
        <FieldBlock
          label="Color & type"
          hint="Primary accent and the font used in the widget."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <MiniLabel htmlFor="appearance-primary">Primary color</MiniLabel>
              <div className="flex items-center gap-2">
                <input
                  id="appearance-primary"
                  type="color"
                  value={
                    /^#[0-9A-Fa-f]{6}$/.test(primary) ? primary : "#0b5f58"
                  }
                  onChange={(e) => patch({ primaryColor: e.target.value })}
                  className="size-11 cursor-pointer rounded-xl border border-border bg-card p-1"
                  aria-label="Pick primary color"
                />
                <Input
                  value={appearance.primaryColor}
                  onChange={(e) => patch({ primaryColor: e.target.value })}
                  placeholder="#0b5f58"
                  className={`${fieldClass} font-mono uppercase`}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-11 shrink-0"
                  title="Reset to Aide teal"
                  onClick={() =>
                    patch({
                      primaryColor:
                        DEFAULT_CUSTOMIZATION.appearance.primaryColor,
                    })
                  }
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              </div>
            </div>
            <div>
              <MiniLabel>Font</MiniLabel>
              <Select
                value={appearance.font}
                onValueChange={(font) => {
                  if (font != null) patch({ font });
                }}
              >
                <SelectTrigger className={fieldClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {FONTS.map((font) => (
                      <SelectItem key={font.id} value={font.id}>
                        {font.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </FieldBlock>
      </FormSection>

      <FormSection title="Theme">
        <FieldBlock label="Theme mode" hint="Overall look of the chat window.">
          <div className="grid grid-cols-2 gap-3">
            <ChoiceCard
              title="Light"
              selected={appearance.theme === "light"}
              onClick={() => patch({ theme: "light" })}
            >
              <div className="w-full max-w-[120px] rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
                <div className="h-2 w-12 rounded-full bg-slate-200" />
                <div className="mt-2 h-9 rounded-md bg-slate-100" />
              </div>
            </ChoiceCard>
            <ChoiceCard
              title="Dark"
              selected={appearance.theme === "dark"}
              onClick={() => patch({ theme: "dark" })}
            >
              <div className="w-full max-w-[120px] rounded-lg border border-zinc-600 bg-zinc-900 p-2.5 shadow-sm">
                <div className="h-2 w-12 rounded-full bg-zinc-600" />
                <div className="mt-2 h-9 rounded-md bg-zinc-800" />
              </div>
            </ChoiceCard>
          </div>
        </FieldBlock>
      </FormSection>

      <FormSection title="Chat chrome">
        <FieldBlock label="Header style">
          <div className="grid grid-cols-2 gap-3">
            <ChoiceCard
              title="Solid"
              selected={appearance.headerStyle === "solid"}
              onClick={() => patch({ headerStyle: "solid" })}
            >
              <div className="w-full max-w-[120px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="h-7 bg-zinc-900" />
                <div className="h-11 bg-slate-100" />
              </div>
            </ChoiceCard>
            <ChoiceCard
              title="Primary"
              selected={appearance.headerStyle === "primary"}
              onClick={() => patch({ headerStyle: "primary" })}
            >
              <div className="w-full max-w-[120px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="h-7" style={{ backgroundColor: primary }} />
                <div className="h-11 bg-slate-100" />
              </div>
            </ChoiceCard>
          </div>
        </FieldBlock>

        <FieldBlock label="Message styling">
          <div className="grid grid-cols-2 gap-3">
            <ChoiceCard
              title="Light"
              selected={appearance.messageStyle === "light"}
              onClick={() => patch({ messageStyle: "light" })}
            >
              <div className="flex w-full max-w-[130px] flex-col gap-1.5 rounded-lg bg-white p-2 ring-1 ring-slate-200">
                <div className="self-start rounded-2xl bg-slate-200 px-2.5 py-1.5 text-[10px] text-slate-700">
                  Hello
                </div>
                <div
                  className="self-end rounded-2xl px-2.5 py-1.5 text-[10px] text-white"
                  style={{ backgroundColor: primary }}
                >
                  Hi there
                </div>
              </div>
            </ChoiceCard>
            <ChoiceCard
              title="Darker"
              selected={appearance.messageStyle === "darker"}
              onClick={() => patch({ messageStyle: "darker" })}
            >
              <div className="flex w-full max-w-[130px] flex-col gap-1.5 rounded-lg bg-slate-100 p-2 ring-1 ring-slate-200">
                <div className="self-start rounded-2xl bg-zinc-800 px-2.5 py-1.5 text-[10px] text-white">
                  Hello
                </div>
                <div
                  className="self-end rounded-2xl px-2.5 py-1.5 text-[10px] text-white"
                  style={{ backgroundColor: primary }}
                >
                  Hi there
                </div>
              </div>
            </ChoiceCard>
          </div>
        </FieldBlock>

        <FieldBlock
          label="Corner radius"
          hint={`Sharp ↔ Round (${appearance.cornerRadius}px)`}
        >
          <input
            type="range"
            min={0}
            max={28}
            step={1}
            value={appearance.cornerRadius}
            onChange={(e) => patch({ cornerRadius: Number(e.target.value) })}
            className="w-full accent-primary"
          />
          <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
            <span>Sharp</span>
            <span>Round</span>
          </div>
        </FieldBlock>
      </FormSection>

      <FormSection title="Screen position">
        <FieldBlock
          label="Widget placement"
          hint="Where the chat appears on your site. Full screen uses the whole page or embed container."
        >
          <WidgetLayoutPicker deploy={deploy} onChange={patchLayout} />
        </FieldBlock>
      </FormSection>
    </div>
  );
}
