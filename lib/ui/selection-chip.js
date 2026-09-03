import { cn } from "@/lib/utils";

export const selectionChipBase =
  "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40";

export const selectionChipActive =
  "border border-primary/40 bg-transparent text-primary";

export const selectionChipInactive =
  "border border-border bg-transparent text-muted-foreground hover:border-primary/25 hover:text-foreground";

export function selectionChipClass(active, className) {
  return cn(
    selectionChipBase,
    active ? selectionChipActive : selectionChipInactive,
    className
  );
}
