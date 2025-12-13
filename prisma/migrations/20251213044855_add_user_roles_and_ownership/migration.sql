-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- AlterTable
ALTER TABLE "BulkProject" ADD COLUMN     "assignedUsers" JSONB,
ADD COLUMN     "ownerId" TEXT;

-- AlterTable
ALTER TABLE "CustomerProfile" ADD COLUMN     "ownerId" TEXT;

-- AlterTable
ALTER TABLE "Skill" ADD COLUMN     "ownerId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';

-- CreateIndex
CREATE INDEX "BulkProject_ownerId_idx" ON "BulkProject"("ownerId");

-- CreateIndex
CREATE INDEX "CustomerProfile_ownerId_idx" ON "CustomerProfile"("ownerId");

-- CreateIndex
CREATE INDEX "Skill_ownerId_idx" ON "Skill"("ownerId");

-- AddForeignKey
ALTER TABLE "BulkProject" ADD CONSTRAINT "BulkProject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
