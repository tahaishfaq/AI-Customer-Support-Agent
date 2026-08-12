"use client";

import { useEffect, useRef, useState } from "react";
import { FileType2, Upload, X } from "lucide-react";
import { uploadPdfKnowledge } from "@/lib/api/knowledge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const MAX_BYTES = 10 * 1024 * 1024;

function formatBytes(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function isPdfFile(file) {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

export function UploadPdfKnowledge({ agentId, onUploaded, disabled }) {
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setFile(null);
      setDisplayName("");
      setDragOver(false);
      setError("");
      setLoading(false);
    }
  }, [open]);

  function selectFile(nextFile) {
    setError("");
    if (!nextFile) return;

    if (!isPdfFile(nextFile)) {
      setError("Only PDF files are allowed");
      setFile(null);
      return;
    }
    if (nextFile.size > MAX_BYTES) {
      setError("PDF must be 10MB or smaller");
      setFile(null);
      return;
    }

    setFile(nextFile);
    setDisplayName(nextFile.name);
  }

  function onDrop(event) {
    event.preventDefault();
    setDragOver(false);
    const dropped = event.dataTransfer.files?.[0];
    selectFile(dropped);
  }

  async function handleUpload() {
    if (!file) {
      setError("Choose a PDF file to upload");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const name = displayName.trim() || file.name;
      const doc = await uploadPdfKnowledge(agentId, file, name);
      setOpen(false);
      onUploaded?.(doc);
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        className="gap-2"
        onClick={() => setOpen(true)}
      >
        <Upload className="size-4" />
        Upload PDF
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload PDF</DialogTitle>
            <DialogDescription>
              Drag and drop a PDF, or browse your files. We extract the text and
              store it in the knowledge base (max 10MB).
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <button
              type="button"
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragOver(false);
              }}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={cn(
                "flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition",
                dragOver
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                  : "border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-primary)]/40"
              )}
            >
              <span className="flex size-12 items-center justify-center rounded-2xl bg-[var(--color-info)]/10 text-[var(--color-info)]">
                <Upload className="size-6" />
              </span>
              <p className="mt-4 text-sm font-medium text-[var(--color-text)]">
                Drop your PDF here
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                or click to browse
              </p>
            </button>

            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                selectFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />

            {file ? (
              <div className="flex items-start gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-info)]/10 text-[var(--color-info)]">
                  <FileType2 className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--color-text)]">
                    {file.name}
                  </p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {formatBytes(file.size)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  disabled={loading}
                  onClick={() => {
                    setFile(null);
                    setDisplayName("");
                  }}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : null}

            <div>
              <Label htmlFor="pdf-display-name">Display name (optional)</Label>
              <Input
                id="pdf-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={loading || !file}
                placeholder="Product Guide.pdf"
                className="mt-1.5"
              />
            </div>

            {error ? (
              <p className="text-sm text-[var(--color-danger)]">{error}</p>
            ) : null}
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={loading || !file}
              onClick={handleUpload}
            >
              {loading ? "Uploading…" : "Upload to knowledge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
