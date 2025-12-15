-- CreateEnum
CREATE TYPE "RowReviewStatus" AS ENUM ('NONE', 'REQUESTED', 'APPROVED', 'CORRECTED');

-- AlterTable
ALTER TABLE "BulkRow" ADD COLUMN     "reviewStatus" "RowReviewStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT,
ADD COLUMN     "userEditedAnswer" TEXT;

-- AlterTable
ALTER TABLE "QuestionHistory" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewStatus" "RowReviewStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedBy" TEXT,
ADD COLUMN     "userEditedAnswer" TEXT;
