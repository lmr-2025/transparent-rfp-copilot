-- CreateTable
CREATE TABLE "InstructionPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "description" TEXT,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "createdByEmail" TEXT,

    CONSTRAINT "InstructionPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstructionPreset_isShared_idx" ON "InstructionPreset"("isShared");

-- CreateIndex
CREATE INDEX "InstructionPreset_createdBy_idx" ON "InstructionPreset"("createdBy");
