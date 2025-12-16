-- AlterTable
ALTER TABLE "BulkRow" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewRequestedAt" TIMESTAMP(3),
ADD COLUMN     "reviewRequestedBy" TEXT;
