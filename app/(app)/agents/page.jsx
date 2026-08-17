import Link from "next/link";
import { Plus } from "lucide-react";
import { AgentList } from "@/components/agents/AgentList";
import { PageHeader } from "@/components/layout/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AgentsPage() {
  return (
    <main className="hapy-page">
      <PageHeader
        title="Agents"
        description="Create and manage your support assistants."
        actions={
          <Link href="/agents/new" className={cn(buttonVariants(), "gap-1.5")}>
            <Plus className="size-3.5" />
            New agent
          </Link>
        }
      />
      <div className="mt-6">
        <AgentList />
      </div>
    </main>
  );
}
