-- Drop legacy snapshot name columns that can drift from the source of truth
ALTER TABLE "BulkProject" DROP COLUMN IF EXISTS "ownerName";
ALTER TABLE "BulkProject" DROP COLUMN IF EXISTS "customerName";

ALTER TABLE "ContractReview" DROP COLUMN IF EXISTS "customerName";
ALTER TABLE "ContractReview" DROP COLUMN IF EXISTS "ownerName";
DROP INDEX IF EXISTS "ContractReview_customerName_idx";

ALTER TABLE "CollateralOutput" DROP COLUMN IF EXISTS "templateName";
ALTER TABLE "CollateralOutput" DROP COLUMN IF EXISTS "customerName";
