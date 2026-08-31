"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Critical surface error (D0) — thin wrapper over shadcn Alert.
 * Prefer Alert directly in new screens; keep this for existing call sites.
 */
export function InlineAlert({
  children,
  title,
  onRetry,
  retryLabel = "Try again",
  className,
}) {
  if (!children && !title) return null;
  return (
    <Alert variant="destructive" className={cn(className)}>
      {title ? <AlertTitle>{title}</AlertTitle> : null}
      {children ? <AlertDescription>{children}</AlertDescription> : null}
      {onRetry ? (
        <div className="mt-2">
          <Button type="button" variant="link" size="sm" onClick={onRetry}>
            {retryLabel}
          </Button>
        </div>
      ) : null}
    </Alert>
  );
}
