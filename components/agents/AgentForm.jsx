"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAgent, updateAgent } from "@/lib/api/agents";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const DEFAULTS = {
  name: "Hapy Support Assistant",
  description: "AI assistant for answering Hapy customer questions.",
  systemPrompt:
    "You are a helpful customer support agent for Hapy. Answer clearly using only the knowledge provided. If you are unsure, say so. Keep replies concise and professional.",
  welcomeMessage: "Hi! How can I help you today?",
};

const fieldClass =
  "mt-1.5 h-11 rounded-xl border-[var(--color-border)] bg-white text-[var(--color-text)] shadow-none focus-visible:ring-[var(--color-primary)]/20";

const areaClass =
  "mt-1.5 max-h-32 overflow-y-auto rounded-xl border-[var(--color-border)] bg-white text-[var(--color-text)] shadow-none focus-visible:ring-[var(--color-primary)]/20";

const promptClass =
  "mt-1.5 max-h-40 overflow-y-auto rounded-xl border-[var(--color-border)] bg-white text-[var(--color-text)] shadow-none focus-visible:ring-[var(--color-primary)]/20";

export function AgentForm({ mode = "create", initialAgent = null }) {
  const router = useRouter();
  const [name, setName] = useState(initialAgent?.name ?? DEFAULTS.name);
  const [description, setDescription] = useState(
    initialAgent?.description ?? DEFAULTS.description
  );
  const [systemPrompt, setSystemPrompt] = useState(
    initialAgent?.systemPrompt ?? DEFAULTS.systemPrompt
  );
  const [welcomeMessage, setWelcomeMessage] = useState(
    initialAgent?.welcomeMessage ?? DEFAULTS.welcomeMessage
  );
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);

  function validate() {
    const details = {};
    if (!name.trim()) details.name = "Name is required";
    if (!systemPrompt.trim()) details.systemPrompt = "System prompt is required";
    if (!welcomeMessage.trim()) {
      details.welcomeMessage = "Welcome message is required";
    }
    setFieldErrors(details);
    return Object.keys(details).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!validate()) return;

    setLoading(true);
    const payload = {
      name: name.trim(),
      description: description.trim(),
      systemPrompt: systemPrompt.trim(),
      welcomeMessage: welcomeMessage.trim(),
    };

    try {
      if (mode === "edit" && initialAgent?.id) {
        const agent = await updateAgent(initialAgent.id, payload);
        router.push(`/agents/${agent.id}`);
        router.refresh();
      } else {
        const agent = await createAgent(payload);
        router.push(`/agents/${agent.id}`);
        router.refresh();
      }
    } catch (err) {
      if (err.details && Object.keys(err.details).length) {
        setFieldErrors(err.details);
      }
      setError(err.message || "Unable to save agent");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)] sm:p-6"
    >
      <div>
        <Label htmlFor="name" className="text-[var(--color-text)]">
          Name
        </Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          className={fieldClass}
          required
        />
        {fieldErrors.name ? (
          <p className="mt-1.5 text-sm text-[var(--color-danger)]">
            {fieldErrors.name}
          </p>
        ) : null}
      </div>

      <div>
        <Label htmlFor="description" className="text-[var(--color-text)]">
          Description{" "}
          <span className="font-normal text-[var(--color-muted)]">
            (optional)
          </span>
        </Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={loading}
          rows={2}
          className={areaClass}
        />
      </div>

      <div>
        <Label htmlFor="systemPrompt" className="text-[var(--color-text)]">
          System Prompt
        </Label>
        <Textarea
          id="systemPrompt"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          disabled={loading}
          rows={5}
          className={promptClass}
          required
        />
        <p className="mt-1.5 text-xs text-[var(--color-muted)]">
          Tell the model how it should behave and what product it represents.
        </p>
        {fieldErrors.systemPrompt ? (
          <p className="mt-1.5 text-sm text-[var(--color-danger)]">
            {fieldErrors.systemPrompt}
          </p>
        ) : null}
      </div>

      <div>
        <Label htmlFor="welcomeMessage" className="text-[var(--color-text)]">
          Welcome Message
        </Label>
        <Input
          id="welcomeMessage"
          value={welcomeMessage}
          onChange={(e) => setWelcomeMessage(e.target.value)}
          disabled={loading}
          className={fieldClass}
          required
        />
        {fieldErrors.welcomeMessage ? (
          <p className="mt-1.5 text-sm text-[var(--color-danger)]">
            {fieldErrors.welcomeMessage}
          </p>
        ) : null}
      </div>

      {error ? (
        <p
          className="rounded-xl bg-[var(--color-danger)]/5 px-3 py-2 text-sm text-[var(--color-danger)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 border-t border-[var(--color-border)] pt-5 sm:flex-row">
        <Button type="submit" disabled={loading} className="sm:min-w-36">
          {loading
            ? "Saving…"
            : mode === "edit"
              ? "Save changes"
              : "Create agent"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={() => router.push("/agents")}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
