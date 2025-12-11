-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'NEEDS_REVIEW', 'APPROVED');

-- CreateEnum
CREATE TYPE "RowStatus" AS ENUM ('PENDING', 'COMPLETED', 'ERROR');

-- CreateTable
CREATE TABLE "BulkProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "columns" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastModifiedAt" TIMESTAMP(3) NOT NULL,
    "ownerName" TEXT,
    "customerName" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,

    CONSTRAINT "BulkProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkRow" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "response" TEXT NOT NULL DEFAULT '',
    "status" "RowStatus" NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "conversationHistory" JSONB,
    "confidence" TEXT,
    "sources" TEXT,
    "remarks" TEXT,
    "usedSkills" JSONB,
    "showRecommendation" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BulkRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulkProject_status_idx" ON "BulkProject"("status");

-- CreateIndex
CREATE INDEX "BulkProject_lastModifiedAt_idx" ON "BulkProject"("lastModifiedAt");

-- CreateIndex
CREATE INDEX "BulkRow_projectId_idx" ON "BulkRow"("projectId");

-- CreateIndex
CREATE INDEX "BulkRow_status_idx" ON "BulkRow"("status");

-- AddForeignKey
ALTER TABLE "BulkRow" ADD CONSTRAINT "BulkRow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BulkProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
