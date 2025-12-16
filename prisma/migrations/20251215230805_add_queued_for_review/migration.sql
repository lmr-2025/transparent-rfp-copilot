-- AlterTable
ALTER TABLE "BulkRow" ADD COLUMN     "queuedAt" TIMESTAMP(3),
ADD COLUMN     "queuedBy" TEXT,
ADD COLUMN     "queuedForReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "queuedNote" TEXT,
ADD COLUMN     "queuedReviewerId" TEXT,
ADD COLUMN     "queuedReviewerName" TEXT;

-- CreateIndex
CREATE INDEX "BulkRow_queuedForReview_idx" ON "BulkRow"("queuedForReview");
