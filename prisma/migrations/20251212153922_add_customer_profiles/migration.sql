-- CreateTable
CREATE TABLE "CustomerProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "website" TEXT,
    "overview" TEXT NOT NULL,
    "products" TEXT,
    "challenges" TEXT,
    "keyFacts" JSONB,
    "tags" TEXT[],
    "sourceUrls" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastRefreshedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "owners" JSONB,
    "history" JSONB,

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCustomerProfile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectCustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerProfile_isActive_updatedAt_idx" ON "CustomerProfile"("isActive", "updatedAt");

-- CreateIndex
CREATE INDEX "CustomerProfile_industry_idx" ON "CustomerProfile"("industry");

-- CreateIndex
CREATE INDEX "ProjectCustomerProfile_projectId_idx" ON "ProjectCustomerProfile"("projectId");

-- CreateIndex
CREATE INDEX "ProjectCustomerProfile_profileId_idx" ON "ProjectCustomerProfile"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCustomerProfile_projectId_profileId_key" ON "ProjectCustomerProfile"("projectId", "profileId");

-- AddForeignKey
ALTER TABLE "ProjectCustomerProfile" ADD CONSTRAINT "ProjectCustomerProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "BulkProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCustomerProfile" ADD CONSTRAINT "ProjectCustomerProfile_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
