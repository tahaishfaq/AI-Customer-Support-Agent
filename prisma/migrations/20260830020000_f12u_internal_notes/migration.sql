-- F12-U U4: desk internal notes (agent-only, not customer-visible)
-- Prisma disables the migration transaction for ADD VALUE on PostgreSQL.

ALTER TYPE "MessageRole" ADD VALUE IF NOT EXISTS 'INTERNAL';
