import Link from "next/link";
import { AgentForm } from "@/components/agents/AgentForm";

export default function NewAgentPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="animate-fade-up mx-auto max-w-2xl">
        <Link
          href="/agents"
          className="text-sm font-medium text-[var(--color-primary)] underline-offset-2 hover:underline"
        >
          ← Back to agents
        </Link>
        <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-text)] sm:text-4xl">
          Create Agent
        </h1>
        <p className="mt-2 mb-8 text-[var(--color-text-secondary)]">
          Give your assistant a clear role, voice, and first message.
        </p>
      </div>
      <div className="animate-fade-up-delay-1">
        <AgentForm mode="create" />
      </div>
    </main>
  );
}
