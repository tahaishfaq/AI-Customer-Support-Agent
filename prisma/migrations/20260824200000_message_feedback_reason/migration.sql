-- AlterTable
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "feedbackReason" TEXT;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "feedbackAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_feedback_feedbackAt_idx" ON "Message"("feedback", "feedbackAt");
