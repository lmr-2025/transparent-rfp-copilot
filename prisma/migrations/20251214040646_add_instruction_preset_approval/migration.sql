-- CreateEnum
CREATE TYPE "InstructionShareStatus" AS ENUM ('PRIVATE', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "InstructionPreset" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedBy" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "shareRequestedAt" TIMESTAMP(3),
ADD COLUMN     "shareStatus" "InstructionShareStatus" NOT NULL DEFAULT 'PRIVATE';

-- CreateIndex
CREATE INDEX "InstructionPreset_shareStatus_idx" ON "InstructionPreset"("shareStatus");
