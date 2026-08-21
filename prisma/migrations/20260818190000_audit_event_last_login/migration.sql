-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditEvent" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditEvent_adminId_idx" ON "AuditEvent"("adminId");
CREATE INDEX IF NOT EXISTS "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditEvent_action_idx" ON "AuditEvent"("action");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AuditEvent_adminId_fkey'
  ) THEN
    ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_adminId_fkey"
      FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
