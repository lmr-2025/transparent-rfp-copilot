-- CreateTable
CREATE TABLE "PromptBlock" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "variants" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "PromptBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromptModifier" (
    "id" TEXT NOT NULL,
    "modifierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "PromptModifier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromptBlock_blockId_key" ON "PromptBlock"("blockId");

-- CreateIndex
CREATE INDEX "PromptBlock_blockId_idx" ON "PromptBlock"("blockId");

-- CreateIndex
CREATE UNIQUE INDEX "PromptModifier_modifierId_key" ON "PromptModifier"("modifierId");

-- CreateIndex
CREATE INDEX "PromptModifier_modifierId_idx" ON "PromptModifier"("modifierId");

-- CreateIndex
CREATE INDEX "PromptModifier_type_idx" ON "PromptModifier"("type");
