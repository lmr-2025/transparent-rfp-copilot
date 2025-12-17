-- Update any existing APPROVED records to FINALIZED
-- This runs in a separate transaction after the enum value was added
UPDATE "BulkProject" SET "status" = 'FINALIZED' WHERE "status" = 'APPROVED';

-- Note: Postgres doesn't support removing enum values directly.
-- The APPROVED value will remain in the enum but will no longer be used.
