-- CreateEnum
CREATE TYPE "Capability" AS ENUM ('ASK_QUESTIONS', 'CREATE_PROJECTS', 'REVIEW_ANSWERS', 'MANAGE_KNOWLEDGE', 'MANAGE_PROMPTS', 'VIEW_ORG_DATA', 'MANAGE_USERS', 'ADMIN');

-- CreateTable
CREATE TABLE "AuthGroupMapping" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "groupName" TEXT,
    "capabilities" "Capability"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthGroupMapping_pkey" PRIMARY KEY ("id")
);

-- AlterEnum (ProjectStatus: remove APPROVED, use FINALIZED instead)
-- Note: APPROVED was renamed to FINALIZED in a previous migration

-- AlterTable User - Add capabilities columns
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "capabilities" "Capability"[] DEFAULT ARRAY['ASK_QUESTIONS']::"Capability"[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "manualCapabilities" "Capability"[] DEFAULT ARRAY[]::"Capability"[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ssoGroups" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable BulkRow - Add askedBy tracking columns
ALTER TABLE "BulkRow" ADD COLUMN IF NOT EXISTS "askedById" TEXT;
ALTER TABLE "BulkRow" ADD COLUMN IF NOT EXISTS "askedByName" TEXT;
ALTER TABLE "BulkRow" ADD COLUMN IF NOT EXISTS "askedByEmail" TEXT;
ALTER TABLE "BulkRow" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuthGroupMapping_provider_idx" ON "AuthGroupMapping"("provider");
CREATE INDEX IF NOT EXISTS "AuthGroupMapping_isActive_idx" ON "AuthGroupMapping"("isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "AuthGroupMapping_provider_groupId_key" ON "AuthGroupMapping"("provider", "groupId");

-- CreateIndex for BulkRow
CREATE INDEX IF NOT EXISTS "BulkRow_askedById_idx" ON "BulkRow"("askedById");
CREATE INDEX IF NOT EXISTS "BulkRow_createdAt_idx" ON "BulkRow"("createdAt");
