-- AlterTable
ALTER TABLE "KnowledgeDocument" ADD COLUMN     "isReferenceOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "skillId" TEXT;

-- AlterTable
ALTER TABLE "ReferenceUrl" ADD COLUMN     "isReferenceOnly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "skillId" TEXT;

-- AlterTable
ALTER TABLE "Skill" ADD COLUMN     "sourceDocuments" JSONB;

-- CreateIndex
CREATE INDEX "KnowledgeDocument_skillId_idx" ON "KnowledgeDocument"("skillId");

-- CreateIndex
CREATE INDEX "ReferenceUrl_skillId_idx" ON "ReferenceUrl"("skillId");
