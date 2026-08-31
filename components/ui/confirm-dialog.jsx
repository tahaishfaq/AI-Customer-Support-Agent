"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Reusable destructive / confirm modal (ShadCN Dialog).
 * Controlled: pass open + onOpenChange, or use withConfirmState helper below.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "destructive",
  loading = false,
  error = "",
  onConfirm,
  children,
  className,
}) {
  const [busy, setBusy] = useState(false);
  const pending = loading || busy;

  async function handleConfirm() {
    if (!onConfirm || pending) return;
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange?.(false);
    } catch {
      /* parent may set error; keep open */
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-md", className)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        {children}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange?.(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            disabled={pending}
            onClick={handleConfirm}
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook-style state helper for imperative confirms (replace window.confirm).
 *
 * const [confirm, setConfirm] = useState(null);
 * <ConfirmDialog
 *   open={Boolean(confirm)}
 *   onOpenChange={(o) => !o && setConfirm(null)}
 *   {...confirm}
 * />
 * setConfirm({ title, description, confirmLabel, onConfirm: async () => {...} })
 */
export function confirmProps(state, setState) {
  if (!state) {
    return {
      open: false,
      onOpenChange: () => {},
      title: "",
      onConfirm: () => {},
    };
  }
  return {
    open: true,
    onOpenChange: (open) => {
      if (!open) setState(null);
    },
    title: state.title,
    description: state.description,
    confirmLabel: state.confirmLabel,
    cancelLabel: state.cancelLabel,
    variant: state.variant ?? "destructive",
    error: state.error,
    onConfirm: async () => {
      await state.onConfirm?.();
      setState(null);
    },
  };
}
