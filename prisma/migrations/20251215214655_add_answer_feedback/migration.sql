-- CreateEnum
CREATE TYPE "FeedbackRating" AS ENUM ('THUMBS_UP', 'THUMBS_DOWN');

-- CreateTable
CREATE TABLE "AnswerFeedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "feature" TEXT NOT NULL,
    "rating" "FeedbackRating" NOT NULL,
    "comment" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "confidence" TEXT,
    "skillsUsed" JSONB,
    "questionHistoryId" TEXT,
    "bulkRowId" TEXT,
    "chatSessionId" TEXT,
    "model" TEXT,
    "usedFallback" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnswerFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnswerFeedback_feature_createdAt_idx" ON "AnswerFeedback"("feature", "createdAt");

-- CreateIndex
CREATE INDEX "AnswerFeedback_rating_createdAt_idx" ON "AnswerFeedback"("rating", "createdAt");

-- CreateIndex
CREATE INDEX "AnswerFeedback_userId_createdAt_idx" ON "AnswerFeedback"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AnswerFeedback_createdAt_idx" ON "AnswerFeedback"("createdAt");

-- AddForeignKey
ALTER TABLE "AnswerFeedback" ADD CONSTRAINT "AnswerFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
