-- Add FINALIZED to ProjectStatus enum
-- Note: Due to PostgreSQL limitations, data migration happens in a separate migration
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'FINALIZED';
