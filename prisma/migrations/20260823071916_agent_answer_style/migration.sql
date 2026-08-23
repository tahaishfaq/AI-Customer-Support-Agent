-- AlterTable
ALTER TABLE "PlatformSettings" ALTER COLUMN "id" SET DEFAULT 'global',
ALTER COLUMN "updatedAt" DROP DEFAULT;
