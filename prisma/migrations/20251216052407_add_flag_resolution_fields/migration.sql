-- AlterTable
ALTER TABLE "BulkRow" ADD COLUMN     "flagResolutionNote" TEXT,
ADD COLUMN     "flagResolved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "flagResolvedAt" TIMESTAMP(3),
ADD COLUMN     "flagResolvedBy" TEXT;

-- AlterTable
ALTER TABLE "QuestionHistory" ADD COLUMN     "flagResolutionNote" TEXT,
ADD COLUMN     "flagResolved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "flagResolvedAt" TIMESTAMP(3),
ADD COLUMN     "flagResolvedBy" TEXT;
