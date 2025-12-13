-- CreateEnum
CREATE TYPE "ContractReviewStatus" AS ENUM ('PENDING', 'ANALYZING', 'ANALYZED', 'REVIEWED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "ContractReview" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "customerName" TEXT,
    "contractType" TEXT,
    "extractedText" TEXT NOT NULL,
    "status" "ContractReviewStatus" NOT NULL DEFAULT 'PENDING',
    "overallRating" TEXT,
    "summary" TEXT,
    "findings" JSONB,
    "skillsUsed" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "analyzedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "notes" TEXT,

    CONSTRAINT "ContractReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContractReview_status_idx" ON "ContractReview"("status");

-- CreateIndex
CREATE INDEX "ContractReview_createdAt_idx" ON "ContractReview"("createdAt");

-- CreateIndex
CREATE INDEX "ContractReview_customerName_idx" ON "ContractReview"("customerName");
