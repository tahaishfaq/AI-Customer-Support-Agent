-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "RestoreRequestStatus" AS ENUM ('PENDING', 'CLOSED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "RestoreRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "RestoreRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestoreRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RestoreRequest_userId_idx" ON "RestoreRequest"("userId");
CREATE INDEX IF NOT EXISTS "RestoreRequest_status_createdAt_idx" ON "RestoreRequest"("status", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RestoreRequest_userId_fkey'
  ) THEN
    ALTER TABLE "RestoreRequest" ADD CONSTRAINT "RestoreRequest_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
