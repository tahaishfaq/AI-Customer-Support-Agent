import Link from "next/link";
import { Plus } from "lucide-react";
import { AgentList } from "@/components/agents/AgentList";
import { PageHeader } from "@/components/layout/PageHeader";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AgentsPage() {
  return (
    <div className="aide-page">
      <PageHeader
        title="All agents"
        description="Create and manage your support assistants."
        actions={
          <Link
            href="/agents/new"
            className={cn(
              buttonVariants(),
              "gap-1.5 rounded-full"
            )}
          >
            <Plus data-icon="inline-start" />
            New agent
          </Link>
        }
      />
      <div className="mt-6">
        <AgentList />
      </div>
    </div>
  );
}
