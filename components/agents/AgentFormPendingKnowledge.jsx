"use client";

import { useState } from "react";
import { FileText, FileType2, Plus, Trash2 } from "lucide-react";
import { AddTextKnowledgeDialog } from "@/components/knowledge/AddTextKnowledgeDialog";
import { UploadPdfKnowledge } from "@/components/knowledge/UploadPdfKnowledge";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { cn } from "@/lib/utils";

function pendingId() {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AgentFormPendingKnowledge({
  items = [],
  onChange,
  disabled = false,
}) {
  const [textOpen, setTextOpen] = useState(false);

  function addDraft(item) {
    onChange?.([item, ...items]);
  }

  function removeDraft(id) {
    onChange?.(items.filter((item) => item.id !== id));
  }

  return (
    <Field>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <FieldLabel>Knowledge base</FieldLabel>
          <FieldDescription>
            Optional — add FAQ, text notes, or PDFs now. They upload right after
            the agent is created.
          </FieldDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={disabled}
            onClick={() => setTextOpen(true)}
          >
            <Plus className="size-3.5" />
            Add Text / FAQ
          </Button>
          <UploadPdfKnowledge
            disabled={disabled}
            onDraft={(draft) =>
              addDraft({
                id: pendingId(),
                type: "PDF",
                name: draft.name,
                file: draft.file,
              })
            }
          />
        </div>
      </div>

      {items.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2 rounded-xl border border-border bg-muted/20 p-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg",
                  item.type === "PDF"
                    ? "bg-sky-500/10 text-sky-700 dark:text-sky-400"
                    : "bg-primary/10 text-primary"
                )}
              >
                {item.type === "PDF" ? (
                  <FileType2 className="size-4" />
                ) : (
                  <FileText className="size-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {item.type === "PDF"
                    ? `${item.file?.name || "PDF"} · queued for upload`
                    : "Text / FAQ · queued for upload"}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={disabled}
                onClick={() => removeDraft(item.id)}
                aria-label={`Remove ${item.name}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">
          No files queued yet — add FAQ, notes, or a PDF to ground answers from day
          one.
        </p>
      )}

      <AddTextKnowledgeDialog
        open={textOpen}
        onOpenChange={setTextOpen}
        onDraft={(draft) =>
          addDraft({
            id: pendingId(),
            type: "TEXT",
            name: draft.name,
            content: draft.content,
          })
        }
      />
    </Field>
  );
}
