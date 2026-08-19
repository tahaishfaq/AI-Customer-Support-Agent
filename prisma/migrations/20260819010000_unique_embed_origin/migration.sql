-- One live embed origin per agent; one agent per website.
UPDATE "Agent"
SET "siteKnowledgeOrigin" = NULL
WHERE "siteKnowledgeOrigin" = '';

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "siteKnowledgeOrigin"
      ORDER BY "siteCrawledAt" ASC NULLS LAST, "createdAt" ASC
    ) AS rn
  FROM "Agent"
  WHERE "siteKnowledgeOrigin" IS NOT NULL
)
UPDATE "Agent"
SET "siteKnowledgeOrigin" = NULL
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS "Agent_siteKnowledgeOrigin_key"
ON "Agent" ("siteKnowledgeOrigin");
