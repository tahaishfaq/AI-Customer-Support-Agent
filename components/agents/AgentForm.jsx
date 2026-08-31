"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Expand } from "lucide-react";
import { toast } from "sonner";
import { createAgent, updateAgent } from "@/lib/api/agents";
import {
  createTextKnowledge,
  uploadPdfKnowledge,
} from "@/lib/api/knowledge";
import {
  RECOMMENDED_ROLE_TEMPLATE,
  ANSWER_STYLE_OPTIONS,
} from "@/lib/services/ai/prompt-builder";
import { AgentFormPendingKnowledge } from "@/components/agents/AgentFormPendingKnowledge";
import { SystemPromptExpandDialog } from "@/components/agents/SystemPromptExpandDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

const DEFAULTS = {
  name: "Aide Support Assistant",
  description: "AI assistant for answering Aide customer questions.",
  systemPrompt: RECOMMENDED_ROLE_TEMPLATE,
  welcomeMessage: "Hi! How can I help you today?",
  answerStyle: "HYBRID",
};

const USE_CASES = [
  {
    id: "faq",
    label: "FAQ / help center",
    hint: "Answer from docs and FAQs",
    name: "Help Center Assistant",
    description: "Answers product and policy questions from your knowledge base.",
    welcomeMessage: "Hi! Ask me anything about our products or policies.",
    answerStyle: "HYBRID",
    systemPrompt: `You are a help-center assistant for this business.
Answer from the knowledge provided. Prefer clear steps and short bullet lists when policies or how-tos are involved.
If the knowledge does not cover the question, say so — do not invent product facts, prices, or policies.`,
  },
  {
    id: "self_service",
    label: "Self-service",
    hint: "Orders, status, account tasks",
    name: "Self-Service Assistant",
    description: "Helps customers check status and complete common tasks.",
    welcomeMessage: "Hi! I can help with orders, status, and account questions.",
    answerStyle: "DETAILED",
    systemPrompt: `You are a self-service support agent for this business.
Help customers complete common tasks using the knowledge and tools available. Ask for missing details (order id, email) when needed.
If you cannot complete the task from knowledge or tools, say what is missing and offer to hand off to a human.`,
  },
  {
    id: "handoff",
    label: "Live handoff",
    hint: "Escalate to human agents",
    name: "Frontline Assistant",
    description: "Triages questions and hands off to your desk when needed.",
    welcomeMessage: "Hi! I can help right away — or connect you with a teammate.",
    answerStyle: "SHORT",
    systemPrompt: `You are a frontline support agent for this business.
Resolve simple questions from knowledge. When the customer is frustrated, asks for a human, or the issue needs account changes you cannot make, offer a clear handoff to a teammate.
Stay polite and brief.`,
  },
  {
    id: "sales",
    label: "Sales / leads",
    hint: "Qualify and capture interest",
    name: "Sales Concierge",
    description: "Answers product questions and captures buying interest.",
    welcomeMessage: "Hi! Looking for the right plan or feature? Ask away.",
    answerStyle: "HYBRID",
    systemPrompt: `You are a sales and product concierge for this business.
Answer product questions from knowledge. Help visitors compare options and capture interest (use case, timeline, contact) when appropriate.
Do not invent pricing or guarantees. If unsure, say so and offer a human follow-up.`,
  },
];

function promptsMatch(a, b) {
  return String(a || "").trim() === String(b || "").trim();
}

export function AgentForm({ mode = "create", initialAgent = null }) {
  const router = useRouter();
  const [useCase, setUseCase] = useState([]);
  const [name, setName] = useState(initialAgent?.name ?? DEFAULTS.name);
  const [description, setDescription] = useState(
    initialAgent?.description ?? DEFAULTS.description
  );
  const [systemPrompt, setSystemPrompt] = useState(
    initialAgent?.systemPrompt ?? DEFAULTS.systemPrompt
  );
  const [answerStyle, setAnswerStyle] = useState(
    initialAgent?.answerStyle ?? DEFAULTS.answerStyle
  );
  const [useRecommendedTemplate, setUseRecommendedTemplate] = useState(() =>
    promptsMatch(
      initialAgent?.systemPrompt ?? DEFAULTS.systemPrompt,
      RECOMMENDED_ROLE_TEMPLATE
    )
  );
  const [welcomeMessage, setWelcomeMessage] = useState(
    initialAgent?.welcomeMessage ?? DEFAULTS.welcomeMessage
  );
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [promptModalOpen, setPromptModalOpen] = useState(false);
  const [pendingKnowledge, setPendingKnowledge] = useState([]);

  function applyUseCase(next) {
    const id = next?.[0];
    setUseCase(id ? [id] : []);
    if (!id) return;
    const preset = USE_CASES.find((c) => c.id === id);
    if (!preset) return;
    setName(preset.name);
    setDescription(preset.description);
    setWelcomeMessage(preset.welcomeMessage);
    setAnswerStyle(preset.answerStyle);
    setSystemPrompt(preset.systemPrompt);
    setUseRecommendedTemplate(
      promptsMatch(preset.systemPrompt, RECOMMENDED_ROLE_TEMPLATE)
    );
  }

  function handleRecommendedTemplateChange(checked) {
    setUseRecommendedTemplate(checked);
    if (checked) {
      setSystemPrompt(RECOMMENDED_ROLE_TEMPLATE);
      setUseCase([]);
    }
  }

  function handleSystemPromptChange(value) {
    setSystemPrompt(value);
    setUseRecommendedTemplate(promptsMatch(value, RECOMMENDED_ROLE_TEMPLATE));
  }

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
      answerStyle,
      welcomeMessage: welcomeMessage.trim(),
    };

    try {
      if (mode === "edit" && initialAgent?.id) {
        const agent = await updateAgent(initialAgent.id, payload);
        router.push(`/agents/${agent.id}`);
        router.refresh();
      } else {
        const agent = await createAgent(payload);

        if (pendingKnowledge.length > 0) {
          let uploaded = 0;
          for (const item of pendingKnowledge) {
            try {
              if (item.type === "PDF" && item.file) {
                await uploadPdfKnowledge(agent.id, item.file, item.name);
              } else if (item.type === "TEXT" && item.content) {
                await createTextKnowledge(agent.id, {
                  name: item.name,
                  content: item.content,
                });
              }
              uploaded += 1;
            } catch (uploadErr) {
              console.error("Knowledge upload failed during agent create", uploadErr);
            }
          }
          if (uploaded > 0 && uploaded < pendingKnowledge.length) {
            toast.warning(
              `Agent created. ${uploaded} of ${pendingKnowledge.length} knowledge items uploaded — add the rest from Knowledge.`
            );
          } else if (uploaded === pendingKnowledge.length) {
            toast.success(
              `Agent created with ${uploaded} knowledge item${uploaded === 1 ? "" : "s"}.`
            );
          } else {
            toast.error(
              "Agent created, but knowledge upload failed. Add documents from the Knowledge tab."
            );
          }
        }

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

  const isCreate = mode === "create";
  const promptRows = isCreate ? 7 : 8;
  const promptMinHeight = isCreate ? "min-h-[180px]" : "min-h-[200px]";

  const nameField = (
    <Field data-invalid={Boolean(fieldErrors.name) || undefined}>
      <FieldLabel htmlFor="name">Name</FieldLabel>
      <Input
        id="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={loading}
        className="h-11"
        required
      />
      {fieldErrors.name ? <FieldError>{fieldErrors.name}</FieldError> : null}
    </Field>
  );

  const descriptionField = (
    <Field>
      <FieldLabel htmlFor="description">
        Description{" "}
        <span className="font-normal text-muted-foreground">(optional)</span>
      </FieldLabel>
      <Textarea
        id="description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        disabled={loading}
        rows={isCreate ? 4 : 2}
        className="min-h-[104px] resize-none"
      />
    </Field>
  );

  const promptSection = (
    <div className="flex flex-col gap-3">
      <Field orientation="horizontal" className="items-start">
        <Checkbox
          id="useRecommendedTemplate"
          checked={useRecommendedTemplate}
          onCheckedChange={(checked) =>
            handleRecommendedTemplateChange(checked === true)
          }
          disabled={loading}
        />
        <div className="flex flex-col gap-0.5">
          <FieldLabel
            htmlFor="useRecommendedTemplate"
            className="cursor-pointer"
          >
            Use recommended grounding template
          </FieldLabel>
          <FieldDescription>
            Pre-fills a safe role paragraph. Response rules are always added
            automatically in chat.
          </FieldDescription>
        </div>
      </Field>

      <Field data-invalid={Boolean(fieldErrors.systemPrompt) || undefined}>
        <div className="flex items-center justify-between gap-2">
          <FieldLabel htmlFor="systemPrompt">System Prompt</FieldLabel>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 gap-1.5"
            disabled={loading}
            onClick={() => setPromptModalOpen(true)}
          >
            <Expand className="size-3.5" />
            Expand
          </Button>
        </div>
        <Textarea
          id="systemPrompt"
          value={systemPrompt}
          onChange={(e) => handleSystemPromptChange(e.target.value)}
          disabled={loading}
          rows={promptRows}
          className={cn(
            "mt-1.5 resize-y font-mono text-sm leading-relaxed",
            promptMinHeight
          )}
          required
        />
        <FieldDescription>
          Role and personality only — use Expand for long prompts.
        </FieldDescription>
        {fieldErrors.systemPrompt ? (
          <FieldError>{fieldErrors.systemPrompt}</FieldError>
        ) : null}
      </Field>

      <SystemPromptExpandDialog
        open={promptModalOpen}
        onOpenChange={setPromptModalOpen}
        value={systemPrompt}
        onChange={handleSystemPromptChange}
        disabled={loading}
      />
    </div>
  );

  const answerStyleField = (
    <Field>
      <FieldLabel htmlFor="answerStyle">Answer style</FieldLabel>
      <Select
        value={answerStyle}
        onValueChange={(v) => {
          if (v != null) setAnswerStyle(v);
        }}
        disabled={loading}
      >
        <SelectTrigger id="answerStyle" className="h-11 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {ANSWER_STYLE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <FieldDescription>
        Hybrid lets the agent choose short vs detailed per question.
      </FieldDescription>
    </Field>
  );

  const welcomeField = (
    <Field data-invalid={Boolean(fieldErrors.welcomeMessage) || undefined}>
      <FieldLabel htmlFor="welcomeMessage">Welcome Message</FieldLabel>
      <Input
        id="welcomeMessage"
        value={welcomeMessage}
        onChange={(e) => setWelcomeMessage(e.target.value)}
        disabled={loading}
        className="h-11"
        required
      />
      {fieldErrors.welcomeMessage ? (
        <FieldError>{fieldErrors.welcomeMessage}</FieldError>
      ) : null}
    </Field>
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8"
    >
      <FieldGroup className="gap-6">
        {isCreate ? (
          <Field>
            <FieldLabel>What should this agent do?</FieldLabel>
            <FieldDescription>
              Pick a starting use case — you can edit everything below.
            </FieldDescription>
            <ToggleGroup
              value={useCase}
              onValueChange={applyUseCase}
              variant="outline"
              spacing={2}
              className="mt-1 flex w-full flex-wrap"
              aria-label="Agent use case"
            >
              {USE_CASES.map((c) => (
                <ToggleGroupItem
                  key={c.id}
                  value={c.id}
                  disabled={loading}
                  className={cn(
                    "h-auto min-h-11 flex-1 basis-[calc(50%-0.25rem)] flex-col items-start gap-1 rounded-xl px-3.5 py-3 text-left whitespace-normal sm:basis-[calc(25%-0.375rem)]",
                    useCase[0] === c.id && "border-primary bg-accent/40"
                  )}
                >
                  <span className="text-sm font-medium">{c.label}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {c.hint}
                  </span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
        ) : null}

        {isCreate ? (
          <div className="grid items-start gap-6 lg:grid-cols-2 lg:gap-10">
            <div className="flex flex-col gap-6">
              {nameField}
              {descriptionField}
              {answerStyleField}
              {welcomeField}
            </div>
            <div className="flex flex-col gap-6">
              {promptSection}
              <AgentFormPendingKnowledge
                items={pendingKnowledge}
                onChange={setPendingKnowledge}
                disabled={loading}
              />
            </div>
          </div>
        ) : (
          <>
            {nameField}
            {descriptionField}
            {promptSection}
            {answerStyleField}
            {welcomeField}
          </>
        )}

        {error ? (
          <p
            className="rounded-lg bg-destructive/5 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row">
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
      </FieldGroup>
    </form>
  );
}
