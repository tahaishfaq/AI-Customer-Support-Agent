"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createTextKnowledge } from "@/lib/api/knowledge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildFaqMarkdown } from "@/components/knowledge/KnowledgeMarkdown";
import { cn } from "@/lib/utils";

const EMPTY_PAIR = { question: "", answer: "" };

function blankFaq() {
  return [
    {
      question: "What services does Hapy provide?",
      answer:
        "Hapy provides custom software development, web applications, AI solutions and SaaS products.",
    },
  ];
}

export function AddTextKnowledgeDialog({
  agentId,
  open,
  onOpenChange,
  onCreated,
}) {
  const [mode, setMode] = useState("faq");
  const [name, setName] = useState("Services FAQ");
  const [pairs, setPairs] = useState(blankFaq);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  function reset() {
    setMode("faq");
    setName("Services FAQ");
    setPairs(blankFaq());
    setNotes("");
    setError("");
    setFieldErrors({});
  }

  function patchPair(index, partial) {
    setPairs((prev) =>
      prev.map((pair, i) => (i === index ? { ...pair, ...partial } : pair))
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    const details = {};
    if (!name.trim()) details.name = "Name is required";

    let content = "";
    if (mode === "faq") {
      const filled = pairs.filter(
        (p) => p.question.trim() && p.answer.trim()
      );
      if (!filled.length) {
        details.content = "Add at least one question and answer";
      } else {
        content = buildFaqMarkdown(filled);
      }
    } else if (!notes.trim()) {
      details.content = "Content is required";
    } else {
      content = notes.trim();
    }

    setFieldErrors(details);
    if (Object.keys(details).length) return;

    setLoading(true);
    try {
      const doc = await createTextKnowledge(agentId, {
        name: name.trim(),
        content,
      });
      onOpenChange?.(false);
      reset();
      onCreated?.(doc);
    } catch (err) {
      if (err.details) setFieldErrors(err.details);
      setError(err.message || "Unable to add knowledge");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange?.(next);
      }}
    >
      <DialogContent className="flex h-[min(640px,85dvh)] w-[min(32rem,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <form
          onSubmit={handleSubmit}
          className="flex h-full min-h-0 flex-col"
        >
          <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
            <DialogTitle>Add Text / FAQ</DialogTitle>
            <DialogDescription>
              FAQ uses separate question and answer fields. Notes are free-form
              markdown.
            </DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-[var(--color-bg)] p-1">
              <button
                type="button"
                onClick={() => setMode("faq")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[13px] font-medium",
                  mode === "faq"
                    ? "bg-white text-[var(--color-primary)] shadow-sm"
                    : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
                )}
              >
                FAQ
              </button>
              <button
                type="button"
                onClick={() => setMode("notes")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[13px] font-medium",
                  mode === "notes"
                    ? "bg-white text-[var(--color-primary)] shadow-sm"
                    : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
                )}
              >
                Text notes
              </button>
            </div>

            <div>
              <Label htmlFor="knowledge-name">Name</Label>
              <Input
                id="knowledge-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                className="mt-1.5"
                placeholder="Services FAQ"
                required
              />
              {fieldErrors.name ? (
                <p className="mt-1 text-sm text-[var(--color-danger)]">
                  {fieldErrors.name}
                </p>
              ) : null}
            </div>

            {mode === "faq" ? (
              <div className="space-y-3 pb-1">
                {pairs.map((pair, index) => (
                  <div
                    key={index}
                    className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/50 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] font-semibold text-[var(--color-muted)]">
                        Question {index + 1}
                      </p>
                      {pairs.length > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPairs((prev) => prev.filter((_, i) => i !== index))
                          }
                          className="inline-flex items-center gap-1 text-[12px] text-[var(--color-muted)] hover:text-[var(--color-danger)]"
                        >
                          <Trash2 className="size-3" />
                          Remove
                        </button>
                      ) : null}
                    </div>
                    <div>
                      <Label htmlFor={`knowledge-q-${index}`}>Question</Label>
                      <Input
                        id={`knowledge-q-${index}`}
                        value={pair.question}
                        onChange={(e) =>
                          patchPair(index, { question: e.target.value })
                        }
                        disabled={loading}
                        className="mt-1.5"
                        placeholder="What services does Hapy provide?"
                      />
                    </div>
                    <div>
                      <Label htmlFor={`knowledge-a-${index}`}>Answer</Label>
                      <Textarea
                        id={`knowledge-a-${index}`}
                        value={pair.answer}
                        onChange={(e) =>
                          patchPair(index, { answer: e.target.value })
                        }
                        disabled={loading}
                        rows={4}
                        className="mt-1.5 min-h-24 resize-none"
                        placeholder="Hapy provides custom software development, web applications, AI solutions and SaaS products."
                      />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setPairs((prev) => [...prev, { ...EMPTY_PAIR }])}
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-primary)] hover:underline"
                >
                  <Plus className="size-3.5" />
                  Add another question
                </button>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <Label htmlFor="knowledge-notes">Content</Label>
                <Textarea
                  id="knowledge-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={loading}
                  className="mt-1.5 h-full max-h-none min-h-[220px] flex-1 resize-none"
                  placeholder="# About Hapy Co&#10;&#10;- MVP Development&#10;- AI Integration"
                />
              </div>
            )}

            {fieldErrors.content ? (
              <p className="text-sm text-[var(--color-danger)]">
                {fieldErrors.content}
              </p>
            ) : null}
            {error ? (
              <p className="text-sm text-[var(--color-danger)]">{error}</p>
            ) : null}
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none border-t border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => onOpenChange?.(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Add knowledge"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
