import Link from "next/link";
import { Plus } from "lucide-react";
import { AgentList } from "@/components/agents/AgentList";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AgentsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="animate-fade-up flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--color-primary)]">
            AI agents
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-text)] sm:text-4xl">
            Your support team
          </h1>
          <p className="mt-2 max-w-lg text-[var(--color-text-secondary)]">
            Build assistants with clear prompts and welcome messages. Knowledge
            and chat come next.
          </p>
        </div>
        <Link
          href="/agents/new"
          className={cn(buttonVariants({ size: "lg" }), "gap-2 self-start sm:self-auto")}
        >
          <Plus className="size-4" />
          Create Agent
        </Link>
      </div>

      <div className="animate-fade-up-delay-1 mt-8">
        <AgentList />
      </div>
    </main>
  );
}
