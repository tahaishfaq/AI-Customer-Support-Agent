"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ImagePlus, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { uploadAgentAvatar } from "@/lib/api/agents";
import { cn } from "@/lib/utils";

const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

/** "Paid plans" marker for white-label controls; links to plans when locked. */
export function PlanLock({ allowed }) {
  if (allowed) return null;
  return (
    <Link
      href="/billing/plans"
      className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
    >
      <Lock className="size-3" aria-hidden />
      Paid plans
    </Link>
  );
}

/** Image picker that uploads through the agent image endpoint and stores the https URL. */
export function ImageUploadField({ agentId, value, onChange, label, locked = false, shape = "square", previewClassName }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file) {
    if (!file) return;
    if (file.size > IMAGE_MAX_BYTES) {
      toast.error("Image must be 2MB or smaller");
      return;
    }
    setUploading(true);
    try {
      const data = await uploadAgentAvatar(agentId, file);
      onChange(data.avatarUrl);
    } catch (err) {
      toast.error(err.message || "Unable to upload image");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading || locked}
        aria-label={`Upload ${label}`}
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden border border-border bg-card shadow-sm disabled:cursor-not-allowed disabled:opacity-60",
          shape === "circle" ? "size-12 rounded-full" : "h-12 w-24 rounded-lg",
          previewClassName
        )}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className={cn("size-full", shape === "circle" ? "object-cover" : "object-contain p-1")} />
        ) : (
          <ImagePlus className="size-4 text-muted-foreground" aria-hidden />
        )}
        {uploading ? (
          <span className="absolute inset-0 flex items-center justify-center bg-card/80">
            <Spinner />
          </span>
        ) : null}
      </button>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="link" size="sm" className="h-auto px-0" disabled={uploading || locked} onClick={() => fileRef.current?.click()}>
          {value ? "Replace" : "Upload"} (max 2MB)
        </Button>
        {value && !locked ? (
          <Button type="button" variant="ghost" size="sm" className="h-auto gap-1 px-0 text-muted-foreground hover:text-destructive" onClick={() => onChange(null)}>
            <X className="size-3" aria-hidden />
            Remove
          </Button>
        ) : null}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
