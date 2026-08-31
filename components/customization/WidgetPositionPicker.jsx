"use client";

import { Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  WIDGET_LAYOUT_OPTIONS,
  resolveWidgetLayout,
} from "@/lib/customization/position";

function MiniSite({ layout, onChange, disabled }) {
  const isFull = layout === "full-page";

  return (
    <div
      className={cn(
        "relative aspect-[4/3] w-full max-w-[220px] rounded-lg border border-slate-300 bg-[#eef2f6] dark:border-slate-600 dark:bg-[#1e293b]",
        isFull && "ring-2 ring-primary/40"
      )}
      aria-hidden
    >
      <div
        className={cn(
          "absolute inset-2 rounded-md bg-white/90 dark:bg-slate-800/90",
          isFull && "inset-1.5 bg-primary/10"
        )}
      />
      {isFull ? (
        <span className="absolute inset-0 flex items-center justify-center text-primary">
          <Maximize2 className="size-5" />
        </span>
      ) : (
        WIDGET_LAYOUT_OPTIONS.filter((item) => item.id !== "full-page").map(
          (item) => {
            const active = layout === item.id;
            const sideClass =
              item.id === "bottom-left" ? "left-2" : "right-2";
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                title={item.label}
                aria-label={item.label}
                aria-pressed={active}
                onClick={() => onChange(item.id)}
                className={cn(
                  "absolute bottom-2 size-3 rounded-full border-2 transition-transform",
                  sideClass,
                  active
                    ? "scale-125 border-primary bg-primary"
                    : "border-slate-400/60 bg-slate-400/30 hover:border-primary/60 hover:bg-primary/30 dark:border-slate-500/70 dark:bg-slate-500/40"
                )}
              />
            );
          }
        )
      )}
    </div>
  );
}

export function WidgetLayoutPicker({
  deploy,
  value,
  onChange,
  disabled = false,
  className,
  showHint = true,
}) {
  const layout = value || resolveWidgetLayout(deploy);
  const selectedLabel =
    WIDGET_LAYOUT_OPTIONS.find((item) => item.id === layout)?.label ||
    "Right bottom";

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <MiniSite layout={layout} onChange={onChange} disabled={disabled} />
        <div className="grid flex-1 grid-cols-1 gap-1.5 sm:grid-cols-3">
          {WIDGET_LAYOUT_OPTIONS.map((item) => {
            const active = layout === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => onChange(item.id)}
                className={cn(
                  "rounded-lg border px-2 py-2 text-center text-[11px] font-medium transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      {showHint ? (
        <p className="text-xs text-muted-foreground">
          {layout === "full-page" ? (
            <>
              <span className="font-medium">{selectedLabel}</span> fills the
              page or host container — not a floating bubble.
            </>
          ) : (
            <>
              Default anchor: <span className="font-medium">{selectedLabel}</span>
              .
            </>
          )}
        </p>
      ) : null}
    </div>
  );
}

/** @deprecated Use WidgetLayoutPicker */
export function WidgetPositionPicker(props) {
  return <WidgetLayoutPicker {...props} />;
}
