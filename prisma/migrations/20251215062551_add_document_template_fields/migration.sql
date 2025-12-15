-- AlterTable
ALTER TABLE "KnowledgeDocument" ADD COLUMN     "isTemplate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "templateContent" TEXT;

-- CreateIndex
CREATE INDEX "KnowledgeDocument_isTemplate_idx" ON "KnowledgeDocument"("isTemplate");
