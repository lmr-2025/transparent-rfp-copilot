-- AlterTable
ALTER TABLE "KnowledgeDocument" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "ownerId" TEXT;

-- AlterTable
ALTER TABLE "ReferenceUrl" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "ownerId" TEXT;

-- CreateIndex
CREATE INDEX "KnowledgeDocument_ownerId_idx" ON "KnowledgeDocument"("ownerId");

-- CreateIndex
CREATE INDEX "ReferenceUrl_ownerId_idx" ON "ReferenceUrl"("ownerId");

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferenceUrl" ADD CONSTRAINT "ReferenceUrl_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
