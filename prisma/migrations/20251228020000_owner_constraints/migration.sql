-- Ensure a stable system owner exists (used for backfill) and ownerId columns exist
DO $$
DECLARE
  system_owner_id text := 'system-owner';
  tbl text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE id = system_owner_id) THEN
    INSERT INTO "User" ("id", "name", "email", "createdAt", "updatedAt")
    VALUES (system_owner_id, 'System Owner', 'system@transparent-trust.local', NOW(), NOW());
  END IF;

  -- Ensure ownerId column exists where needed
  FOR tbl IN SELECT unnest(ARRAY['Skill','CustomerProfile','KnowledgeDocument','BulkProject','Template','CollateralOutput','ContractReview']) LOOP
    PERFORM 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'ownerId';
    IF NOT FOUND THEN
      EXECUTE format('ALTER TABLE "%I" ADD COLUMN "ownerId" TEXT', tbl);
    END IF;
  END LOOP;

  UPDATE "Skill" SET "ownerId" = system_owner_id WHERE "ownerId" IS NULL;
  UPDATE "CustomerProfile" SET "ownerId" = system_owner_id WHERE "ownerId" IS NULL;
  UPDATE "KnowledgeDocument" SET "ownerId" = system_owner_id WHERE "ownerId" IS NULL;
  UPDATE "BulkProject" SET "ownerId" = system_owner_id WHERE "ownerId" IS NULL;
  UPDATE "Template" SET "ownerId" = system_owner_id WHERE "ownerId" IS NULL;
  UPDATE "CollateralOutput" SET "ownerId" = system_owner_id WHERE "ownerId" IS NULL;
  UPDATE "ContractReview" SET "ownerId" = system_owner_id WHERE "ownerId" IS NULL;
END$$;

-- Make ownerId NOT NULL and tighten FK delete behavior
ALTER TABLE "Skill" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "CustomerProfile" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "KnowledgeDocument" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "BulkProject" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "Template" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "CollateralOutput" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "ContractReview" ALTER COLUMN "ownerId" SET NOT NULL;

-- Adjust foreign keys to Restrict deletes (prevent orphaning)
ALTER TABLE "Skill" DROP CONSTRAINT IF EXISTS "Skill_ownerId_fkey";
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerProfile" DROP CONSTRAINT IF EXISTS "CustomerProfile_ownerId_fkey";
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "KnowledgeDocument" DROP CONSTRAINT IF EXISTS "KnowledgeDocument_ownerId_fkey";
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BulkProject" DROP CONSTRAINT IF EXISTS "BulkProject_ownerId_fkey";
ALTER TABLE "BulkProject" ADD CONSTRAINT "BulkProject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Template" DROP CONSTRAINT IF EXISTS "Template_ownerId_fkey";
ALTER TABLE "Template" ADD CONSTRAINT "Template_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CollateralOutput" DROP CONSTRAINT IF EXISTS "CollateralOutput_ownerId_fkey";
ALTER TABLE "CollateralOutput" ADD CONSTRAINT "CollateralOutput_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ContractReview" DROP CONSTRAINT IF EXISTS "ContractReview_ownerId_fkey";
ALTER TABLE "ContractReview" ADD CONSTRAINT "ContractReview_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
