-- Step 1: Add slug column as nullable
ALTER TABLE "Workspace" ADD COLUMN "slug" TEXT;

-- Step 2: Backfill existing rows — slug = lowercased name with spaces → hyphens
UPDATE "Workspace"
SET "slug" = LOWER(REGEXP_REPLACE(TRIM("name"), '\s+', '-', 'g'))
WHERE "slug" IS NULL;

-- Step 3: Fallback for any empty slugs
UPDATE "Workspace"
SET "slug" = "id"
WHERE "slug" IS NULL OR "slug" = '';

-- Step 4: Make slug NOT NULL
ALTER TABLE "Workspace" ALTER COLUMN "slug" SET NOT NULL;

-- Step 5: Add unique constraint (userId, slug)
CREATE UNIQUE INDEX "Workspace_userId_slug_key" ON "Workspace"("userId", "slug");
