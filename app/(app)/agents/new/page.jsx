import Link from "next/link";
import { AgentForm } from "@/components/agents/AgentForm";

export default function NewAgentPage() {
  return (
    <main className="hapy-page">
      <header>
        <Link
          href="/agents"
          className="text-[13px] font-medium text-[var(--color-primary)] hover:underline"
        >
          ← Agents
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-[var(--color-text)] sm:text-2xl">
          New agent
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Give your assistant a clear role, voice, and first message.
        </p>
      </header>

      <div className="mt-6 max-w-2xl">
        <AgentForm mode="create" />
      </div>
    </main>
  );
}
