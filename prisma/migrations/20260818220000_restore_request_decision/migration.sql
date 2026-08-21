-- PENDING | CLOSED → PENDING | APPROVED | REJECTED
CREATE TYPE "RestoreRequestStatus_new" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "RestoreRequest" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "RestoreRequest"
  ALTER COLUMN "status" TYPE "RestoreRequestStatus_new"
  USING (
    CASE
      WHEN status::text = 'CLOSED' THEN 'APPROVED'
      WHEN status::text = 'APPROVED' THEN 'APPROVED'
      WHEN status::text = 'REJECTED' THEN 'REJECTED'
      ELSE 'PENDING'
    END
  )::"RestoreRequestStatus_new";

ALTER TYPE "RestoreRequestStatus" RENAME TO "RestoreRequestStatus_old";
ALTER TYPE "RestoreRequestStatus_new" RENAME TO "RestoreRequestStatus";
DROP TYPE "RestoreRequestStatus_old";

ALTER TABLE "RestoreRequest" ALTER COLUMN "status" SET DEFAULT 'PENDING';
