"use client";

import { cn } from "@/lib/utils";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";

/** Selectable preview card (toggle / launcher / theme). */
export function ChoiceCard({ selected, onClick, title, children, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-colors",
        selected
          ? "border-primary bg-accent/40 ring-1 ring-primary"
          : "border-border hover:border-primary/40",
        className
      )}
    >
      <div className="flex min-h-[88px] flex-1 items-center justify-center bg-[#eef2f6] p-3 dark:bg-[#1e293b]">
        {children}
      </div>
      <div className="border-t border-border px-3 py-2.5 text-center text-sm font-semibold">
        {title}
      </div>
    </button>
  );
}

/** Grouped field surface — label + hint + controls. */
export function FieldBlock({ label, hint, children, className }) {
  return (
    <Field className={cn("rounded-xl border border-border bg-muted/30 p-4", className)}>
      <div className="mb-3 flex flex-col gap-0.5">
        <FieldLabel className="text-sm font-semibold text-foreground">
          {label}
        </FieldLabel>
        {hint ? <FieldDescription>{hint}</FieldDescription> : null}
      </div>
      {children}
    </Field>
  );
}

export function FormSection({ title, children }) {
  return (
    <FieldSet className="gap-2.5">
      {title ? (
        <FieldLegend
          variant="label"
          className="px-0.5 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase"
        >
          {title}
        </FieldLegend>
      ) : null}
      <FieldGroup className="gap-3">{children}</FieldGroup>
    </FieldSet>
  );
}

export function MiniLabel({ children, htmlFor }) {
  return (
    <FieldLabel
      htmlFor={htmlFor}
      className="mb-1.5 text-xs font-medium text-foreground/80"
    >
      {children}
    </FieldLabel>
  );
}

export const fieldClass =
  "h-10 rounded-lg border-border bg-card shadow-none";

export const areaClass =
  "min-h-[88px] max-h-32 resize-none overflow-y-auto rounded-lg border-border bg-card shadow-none";
