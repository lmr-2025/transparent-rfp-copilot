-- AlterTable
ALTER TABLE "QuestionHistory" ADD COLUMN     "assignedReviewerId" TEXT,
ADD COLUMN     "assignedReviewerName" TEXT,
ADD COLUMN     "flagNote" TEXT,
ADD COLUMN     "flaggedAt" TIMESTAMP(3),
ADD COLUMN     "flaggedBy" TEXT,
ADD COLUMN     "flaggedForReview" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reviewRequestedAt" TIMESTAMP(3),
ADD COLUMN     "reviewRequestedBy" TEXT;

-- CreateIndex
CREATE INDEX "QuestionHistory_flaggedForReview_idx" ON "QuestionHistory"("flaggedForReview");
