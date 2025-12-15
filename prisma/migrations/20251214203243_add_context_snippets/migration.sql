-- AlterEnum
ALTER TYPE "AuditEntityType" ADD VALUE 'CONTEXT_SNIPPET';

-- CreateTable
CREATE TABLE "ContextSnippet" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "ContextSnippet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContextSnippet_key_key" ON "ContextSnippet"("key");

-- CreateIndex
CREATE INDEX "ContextSnippet_category_idx" ON "ContextSnippet"("category");

-- CreateIndex
CREATE INDEX "ContextSnippet_isActive_idx" ON "ContextSnippet"("isActive");

-- CreateIndex
CREATE INDEX "ContextSnippet_key_idx" ON "ContextSnippet"("key");
