"use client";

import { useState } from "react";
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

export function AddTextKnowledgeDialog({
  agentId,
  open,
  onOpenChange,
  onCreated,
}) {
  const [name, setName] = useState("Services FAQ");
  const [content, setContent] = useState(
    "Q: What services does Hapy provide?\nA: Hapy provides custom software development, web applications, AI solutions and SaaS products."
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  function reset() {
    setName("Services FAQ");
    setContent(
      "Q: What services does Hapy provide?\nA: Hapy provides custom software development, web applications, AI solutions and SaaS products."
    );
    setError("");
    setFieldErrors({});
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    const details = {};
    if (!name.trim()) details.name = "Name is required";
    if (!content.trim()) details.content = "Content is required";
    setFieldErrors(details);
    if (Object.keys(details).length) return;

    setLoading(true);
    try {
      const doc = await createTextKnowledge(agentId, {
        name: name.trim(),
        content: content.trim(),
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
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Text / FAQ</DialogTitle>
            <DialogDescription>
              Add plain text knowledge your agent can use when answering.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="knowledge-name">Name</Label>
              <Input
                id="knowledge-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                className="mt-1.5"
                required
              />
              {fieldErrors.name ? (
                <p className="mt-1 text-sm text-[var(--color-danger)]">
                  {fieldErrors.name}
                </p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="knowledge-content">Content</Label>
              <Textarea
                id="knowledge-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={loading}
                rows={6}
                className="mt-1.5"
                required
              />
              {fieldErrors.content ? (
                <p className="mt-1 text-sm text-[var(--color-danger)]">
                  {fieldErrors.content}
                </p>
              ) : null}
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
