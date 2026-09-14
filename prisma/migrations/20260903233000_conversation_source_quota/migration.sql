-- Billable chats are public embed only; studio/test stays free.
CREATE TYPE "ConversationSource" AS ENUM ('STUDIO', 'EMBED');

ALTER TABLE "Conversation"
ADD COLUMN "source" "ConversationSource" NOT NULL DEFAULT 'EMBED';

CREATE INDEX "Conversation_source_idx" ON "Conversation"("source");
