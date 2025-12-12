-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "categories" TEXT[],
    "tags" TEXT[],
    "quickFacts" JSONB,
    "edgeCases" TEXT[],
    "sourceUrls" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastRefreshedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "owners" JSONB,
    "history" JSONB,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemPrompt" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "SystemPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceUrl" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "category" TEXT,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "usageCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReferenceUrl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatPrompt" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "isBuiltin" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "ChatPrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatPromptCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatPromptCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Skill_isActive_updatedAt_idx" ON "Skill"("isActive", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SkillCategory_name_key" ON "SkillCategory"("name");

-- CreateIndex
CREATE INDEX "SkillCategory_sortOrder_idx" ON "SkillCategory"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SystemPrompt_key_key" ON "SystemPrompt"("key");

-- CreateIndex
CREATE INDEX "SystemPrompt_key_idx" ON "SystemPrompt"("key");

-- CreateIndex
CREATE UNIQUE INDEX "ReferenceUrl_url_key" ON "ReferenceUrl"("url");

-- CreateIndex
CREATE INDEX "ReferenceUrl_category_idx" ON "ReferenceUrl"("category");

-- CreateIndex
CREATE INDEX "ReferenceUrl_addedAt_idx" ON "ReferenceUrl"("addedAt");

-- CreateIndex
CREATE INDEX "ChatPrompt_category_idx" ON "ChatPrompt"("category");

-- CreateIndex
CREATE INDEX "ChatPrompt_isBuiltin_idx" ON "ChatPrompt"("isBuiltin");

-- CreateIndex
CREATE UNIQUE INDEX "ChatPromptCategory_name_key" ON "ChatPromptCategory"("name");

-- CreateIndex
CREATE INDEX "ChatPromptCategory_sortOrder_idx" ON "ChatPromptCategory"("sortOrder");
