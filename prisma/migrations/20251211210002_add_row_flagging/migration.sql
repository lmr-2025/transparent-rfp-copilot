-- AlterTable
ALTER TABLE "BulkRow" ADD COLUMN     "flagNote" TEXT,
ADD COLUMN     "flaggedAt" TIMESTAMP(3),
ADD COLUMN     "flaggedBy" TEXT,
ADD COLUMN     "flaggedForReview" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "BulkRow_flaggedForReview_idx" ON "BulkRow"("flaggedForReview");
