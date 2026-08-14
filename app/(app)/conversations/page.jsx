import { ConversationsShell } from "@/components/conversations/ConversationsShell";
import { ConversationEmptyState } from "@/components/conversations/ConversationThread";

export default function ConversationsPage() {
  return (
    <ConversationsShell>
      <ConversationEmptyState />
    </ConversationsShell>
  );
}
